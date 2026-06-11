// ============================================================
// Quiz Arena — Socket.IO Handlers
// ============================================================

import type { Socket, Server } from 'socket.io';
import { QuizArenaService } from '../services/quiz-arena.service';
import { QUIZ_ARENA_SOCKET_EVENTS, SOCKET_EVENTS } from '@uniclub/shared';
import { SocketRegistry, TimerQueueService } from '../../../services';
import { redis } from '../../../config/index';

/**
 * Đăng ký tất cả socket event handlers cho Quiz Arena (So Tài).
 * Match lifecycle: join-session → question → answer loop → end.
 */
export function registerQuizArenaHandlers(io: Server, socket: Socket): void {
  // ============================================================
  // Join session room — client gọi sau khi nhận MATCHMAKING_MATCHED hoặc MATCHMAKING_TIMEOUT
  // ============================================================

  socket.on(QUIZ_ARENA_SOCKET_EVENTS.JOIN_SESSION, async (data: { sessionId: string; userId?: string }) => {
    try {
      const { sessionId } = data;
      if (!sessionId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'sessionId is required' });
        return;
      }

      // Set userId từ payload nếu chưa có (game socket khác với matchmaking socket)
      if (data.userId && !socket.data.userId) {
        socket.data.userId = data.userId;
      }

      if (socket.data.userId) {
        await SocketRegistry.register(socket.data.userId, socket.id);
      }

      socket.data.quizSessionId = sessionId;
      socket.join(sessionId);

      const session = await QuizArenaService.getSession(sessionId);
      if (!session) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found' });
        return;
      }

      // Nếu session vẫn đang 'waiting': kiểm tra cả 2 đã join room chưa
      if (session.status === 'waiting') {
        // fetchSockets() đếm socket trong room XUYÊN các instance (qua Redis adapter).
        // io.sockets.adapter.rooms chỉ thấy socket local — với 2 player trên
        // 2 instance khác nhau, mỗi bên chỉ đếm được 1 và trận không bao giờ start.
        const socketsInRoom = await io.in(sessionId).fetchSockets();
        const playersInRoom = socketsInRoom.length;

        // PvP: chờ cả 2 join; Bot: chỉ cần player join là đủ
        const requiredPlayers = session.isBot ? 1 : 2;
        if (playersInRoom >= requiredPlayers) {
          // NX guard: 2 join event có thể được xử lý song song (2 instance) và
          // cùng thấy đủ người — chỉ 1 bên được phép khởi động countdown
          const countdownGuard = await redis.set(
            `quiz-arena:countdown-lock:${sessionId}`,
            '1',
            'EX',
            30,
            'NX',
          );

          if (countdownGuard) {
            // Gửi COUNTDOWN để client hiển thị countdown đồng bộ
            const countdownMs = 3000; // 3 giây countdown
            const startsAt = Date.now() + countdownMs;
            io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.COUNTDOWN, { startsAt });

            // Đợi countdown xong mới start match — qua BullMQ để không phụ thuộc
            // instance hiện tại còn sống trong 3s tới
            await TimerQueueService.scheduleQuizStartMatch(sessionId, countdownMs);
          }
        }
      } else if (session.status === 'playing') {
        // Reconnect: clear disconnect timer & reset disconnected flag nếu là Bot match
        if (session.isBot && data.userId) {
          QuizArenaService.handleReconnect(sessionId, data.userId);
        }

        // Reconnect: gửi lại state hiện tại cho client
        const currentIdx = session.currentQuestionIndex;
        const question = session.questions[currentIdx];
        if (question) {
          const publicQ = {
            id: question.id,
            grade: question.grade,
            content: question.content,
            options: question.options,
            timeLimitSeconds: question.timeLimitSeconds,
            questionIndex: currentIdx,
            totalQuestions: session.questions.length,
            startedAt: session.currentQuestionStartedAt ?? Date.now(),
            // Giờ server tại lúc gửi lại — client hiệu chỉnh skew để đếm ngược đúng
            serverNow: Date.now(),
          };
          socket.emit(QUIZ_ARENA_SOCKET_EVENTS.QUESTION, publicQ);
        }

        socket.emit(QUIZ_ARENA_SOCKET_EVENTS.STATE, {
          playerA: QuizArenaService.toPublicPlayerState(session.playerAState),
          playerB: QuizArenaService.toPublicPlayerState(session.playerBState),
        });
      }
    } catch (error: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================================
  // Submit answer
  // ============================================================

  socket.on(
    QUIZ_ARENA_SOCKET_EVENTS.ANSWER,
    async (data: { sessionId: string; selectedIndex: number | null }) => {
      try {
        const { sessionId, selectedIndex } = data;
        const userId: string | undefined = socket.data.userId;

        if (!sessionId || !userId) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'sessionId and userId are required' });
          return;
        }

        // selectedIndex phải là 0-3 hoặc null
        if (selectedIndex !== null && (selectedIndex < 0 || selectedIndex > 3)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'selectedIndex must be 0-3 or null' });
          return;
        }

        await QuizArenaService.submitAnswer(sessionId, userId, selectedIndex, io);
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    },
  );

  // ============================================================
  // Disconnect — xử lý mất kết nối giữa trận
  // ============================================================

  socket.on('disconnect', async () => {
    try {
      const userId: string | undefined = socket.data.userId;
      const sessionId: string | undefined = socket.data.quizSessionId;
      if (userId && sessionId) {
        await QuizArenaService.handleDisconnect(sessionId, userId, io);
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}
