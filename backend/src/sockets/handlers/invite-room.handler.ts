// ============================================================
// Invite Room Socket Handler — game-agnostic
// Phòng chờ "Mời bạn" + Tái đấu. Khi cả 2 sẵn sàng → tạo PvP session
// trực tiếp qua factory registry (không qua hàng đợi random).
// ============================================================

import type { Socket, Server } from 'socket.io';
import {
  INVITE_ROOM_SOCKET_EVENTS,
  INVITE_ROOM_ERROR_CODES,
  INVITE_ROOM_CONFIG,
} from '@uniclub/shared';
import type { InviteRoom, MatchmakingGameType } from '@uniclub/shared';
import {
  InviteRoomService,
  InviteRoomError,
  MatchmakingService,
  SocketRegistry,
  TimerQueueService,
} from '../../services';
import { GameConfigService } from '../../services/game-config.service';
import { QuestionService } from '../../games/quiz-arena/services/question.service';

const EXPIRY_MS = INVITE_ROOM_CONFIG.expiryMinutes * 60 * 1000;

interface MemberPayload {
  userId: string;
  displayName?: string;
  grade?: number;
  avatar?: string;
}

/** Số ván tối đa mỗi phòng theo config của game */
async function getMaxGames(gameType: MatchmakingGameType): Promise<number> {
  if (gameType === 'quiz' || gameType === 'quiz_arena') {
    const cfg = await GameConfigService.getQuizArenaConfig().catch(() => null);
    return cfg?.maxGamesPerRoom ?? 3;
  }
  return 3;
}

/** Phát state phòng cho tất cả socket trong room (cross-instance qua Redis adapter) */
function broadcastState(io: Server, room: InviteRoom): void {
  io.to(room.roomId).emit(INVITE_ROOM_SOCKET_EVENTS.STATE, { room });
}

export function registerInviteRoomHandlers(io: Server, socket: Socket): void {
  // ============================================================
  // Create — host tạo phòng
  // ============================================================
  socket.on(
    INVITE_ROOM_SOCKET_EVENTS.CREATE,
    async (data: MemberPayload & { gameType: MatchmakingGameType }) => {
      try {
        const userId = data.userId != null ? String(data.userId) : '';
        if (!userId || !data.gameType) {
          socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: 'userId và gameType là bắt buộc' });
          return;
        }

        // Edge case: khối lớp của host chưa có câu hỏi → không tạo phòng (Quiz Arena)
        if ((data.gameType === 'quiz' || data.gameType === 'quiz_arena') && data.grade != null) {
          const hasQuestions = await QuestionService.hasQuestionsForGrade(data.grade).catch(() => true);
          if (!hasQuestions) {
            socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, {
              message: `Khối ${data.grade} chưa có câu hỏi để chơi.`,
              code: INVITE_ROOM_ERROR_CODES.NO_QUESTIONS,
            });
            return;
          }
        }

        const maxGames = await getMaxGames(data.gameType);
        const room = await InviteRoomService.createRoom(
          {
            userId,
            displayName: data.displayName ?? userId,
            avatar: data.avatar,
            grade: data.grade,
            socketId: socket.id,
          },
          data.gameType,
          maxGames,
        );

        socket.data.userId = userId;
        socket.data.inviteRoomId = room.roomId;
        await SocketRegistry.register(userId, socket.id);
        socket.join(room.roomId);

        // Lịch tự đóng phòng khi hết 30' (job tự dời lịch nếu có hoạt động gia hạn)
        await TimerQueueService.scheduleInviteRoomExpiry(room.roomId, EXPIRY_MS);

        broadcastState(io, room);
      } catch (error: any) {
        socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: error.message });
      }
    },
  );

  // ============================================================
  // Join — guest vào lần đầu, hoặc host/guest reconnect (vào lại từ game page)
  // ============================================================
  socket.on(
    INVITE_ROOM_SOCKET_EVENTS.JOIN,
    async (data: MemberPayload & { roomId: string }) => {
      try {
        const userId = data.userId != null ? String(data.userId) : '';
        if (!userId || !data.roomId) {
          socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: 'userId và roomId là bắt buộc' });
          return;
        }

        const room = await InviteRoomService.joinRoom(data.roomId, {
          userId,
          displayName: data.displayName ?? userId,
          avatar: data.avatar,
          grade: data.grade,
          socketId: socket.id,
        });

        socket.data.userId = userId;
        socket.data.inviteRoomId = room.roomId;
        await SocketRegistry.register(userId, socket.id);
        socket.join(room.roomId);

        broadcastState(io, room);
      } catch (error: any) {
        const code = error instanceof InviteRoomError ? error.code : undefined;
        socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: error.message, code });
      }
    },
  );

  // ============================================================
  // Ready — sẵn sàng / tái đấu. Khi cả 2 ready → bắt đầu ván.
  // ============================================================
  socket.on(
    INVITE_ROOM_SOCKET_EVENTS.READY,
    async (data: { roomId: string; userId: string; ready: boolean }) => {
      try {
        const userId = data.userId != null ? String(data.userId) : '';
        if (!userId || !data.roomId) return;

        socket.data.userId = userId;
        socket.data.inviteRoomId = data.roomId;
        await SocketRegistry.register(userId, socket.id);
        socket.join(data.roomId);

        const room = await InviteRoomService.setReady(data.roomId, userId, data.ready !== false, socket.id);
        broadcastState(io, room);

        // Thử bắt đầu ván (atomic dưới lock — chỉ 1 instance thắng)
        const started = await InviteRoomService.tryStart(data.roomId, async (r) => {
          const [host, guest] = r.members;
          const { sessionId } = await MatchmakingService.createDirectPVPSession(
            r.gameType,
            host.userId,
            guest.userId,
            {
              friendly: true,
              inviteRoomId: r.roomId,
              players: {
                // Câu hỏi theo khối của host → cả 2 dùng grade của host
                a: { displayName: host.displayName, grade: host.grade },
                b: { displayName: guest.displayName, grade: host.grade },
              },
            },
          );
          return sessionId;
        });

        if (started) {
          const { room: updated, sessionId } = started;
          const rematchRemaining = InviteRoomService.rematchRemaining(updated);

          // Đánh dấu active session + emit start theo từng member (role khác nhau).
          // Emit thẳng tới socketId của socket PHÒNG (đã lưu ở member) — tránh trúng
          // nhầm socket gameplay vốn cũng đăng ký vào SocketRegistry cùng userId.
          await Promise.all(
            updated.members.map(async (m) => {
              await MatchmakingService.setActiveSession(m.userId, sessionId, updated.gameType);
              if (m.socketId) {
                io.to(m.socketId).emit(INVITE_ROOM_SOCKET_EVENTS.START, {
                  sessionId,
                  gameType: updated.gameType,
                  roomId: updated.roomId,
                  role: m.isHost ? 'first' : 'second',
                  rematchRemaining,
                });
              }
            }),
          );

          broadcastState(io, updated);
        }
      } catch (error: any) {
        const code = error instanceof InviteRoomError ? error.code : undefined;
        socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: error.message, code });
      }
    },
  );

  // ============================================================
  // Leave — rời phòng / hủy
  // ============================================================
  socket.on(
    INVITE_ROOM_SOCKET_EVENTS.LEAVE,
    async (data: { roomId: string; userId: string }) => {
      try {
        const userId = data.userId != null ? String(data.userId) : '';
        if (!userId || !data.roomId) return;

        const { room, closed, reason } = await InviteRoomService.leaveRoom(data.roomId, userId);
        socket.leave(data.roomId);

        if (closed) {
          io.to(data.roomId).emit(INVITE_ROOM_SOCKET_EVENTS.CLOSED, { reason });
          await InviteRoomService.deleteRoom(data.roomId);
          await TimerQueueService.cancelInviteRoomExpiry(data.roomId);
        } else if (room) {
          broadcastState(io, room);
        }
      } catch (error: any) {
        socket.emit(INVITE_ROOM_SOCKET_EVENTS.ERROR, { message: error.message });
      }
    },
  );
}

export { INVITE_ROOM_ERROR_CODES };
