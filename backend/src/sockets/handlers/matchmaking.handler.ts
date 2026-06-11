// ============================================================
// Matchmaking Socket Handler — game-agnostic
// ============================================================

import type { Socket, Server } from 'socket.io';
import { MatchmakingService } from '../../services/matchmaking.service';
import { GameConfigService } from '../../services/game-config.service';
import {
  MATCHMAKING_SOCKET_EVENTS,
  SOCKET_EVENTS,
} from '@uniclub/shared';
import type { MatchmakingGameType } from '@uniclub/shared';
import { UserAbilityService } from '../../games/quiz-arena/services/user-ability.service';
import { setPendingContext } from '../../games/quiz-arena/services/quiz-matchmaking.factory';
import { UserService, SocketRegistry, TimerQueueService } from '../../services';

async function clearMatchmakingTimeout(userId: string, gameType: MatchmakingGameType): Promise<void> {
  await TimerQueueService.cancelMatchmakingTimeout(userId, gameType);
}

/**
 * Đăng ký matchmaking socket event handlers.
 * Handler này game-agnostic — gameType được truyền từ client.
 */
export function registerMatchmakingHandlers(io: Server, socket: Socket): void {
  // ============================================================
  // Join matchmaking
  // ============================================================

  socket.on(
    MATCHMAKING_SOCKET_EVENTS.JOIN_MATCHMAKING,
    async (data: {
      userId: string;
      gameType: MatchmakingGameType;
      /** Quiz Arena: khối lớp (lấy từ JWT decode phía client và gửi lên) */
      grade?: number;
      /** Quiz Arena: tên hiển thị */
      displayName?: string;
    }) => {
      try {
        const { gameType } = data;
        // Normalize về string — client/REST có thể gửi number, nếu để lẫn kiểu
        // trong queue thì guard chống self-match sẽ so sánh sai
        const userId = data.userId != null ? String(data.userId) : '';
        if (!userId || !gameType) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'userId and gameType are required' });
          return;
        }

        // ---- Guard: chặn join queue nếu user đang trong session active CÙNG gameType ----
        const activeSession = await MatchmakingService.getActiveSession(userId);
        if (activeSession) {
          // Nếu active session khác gameType → session cũ đã stale, clear và cho phép tiếp tục
          if (activeSession.gameType !== gameType) {
            await MatchmakingService.clearActiveSession(userId);
          } else {
            socket.emit(SOCKET_EVENTS.ERROR, {
              message: `Bạn đang trong một trận đấu đang diễn ra (${activeSession.gameType}). Vui lòng hoàn thành hoặc rời trận trước khi tìm trận mới.`,
              code: 'ACTIVE_SESSION_EXISTS',
              activeSessionId: activeSession.sessionId,
              activeGameType: activeSession.gameType,
            });
            return;
          }
        }

        socket.data.userId = userId;
        socket.data.gameType = gameType;
        await SocketRegistry.register(userId, socket.id);

        // ---- Quiz Arena: tính partitionKey và lưu pending context ----
        let partitionKey: string | undefined;
        if (gameType === 'quiz') {
          const grade = data.grade ?? 10;
          const quizConfig = await GameConfigService.getQuizArenaConfig().catch(() => null);
          const abilityBucket = await UserAbilityService.getAbilityBucket(
            userId,
            quizConfig ?? {
              recentMatchesForAbility: 5,
              easyPlayerThreshold: 0.45,
              hardPlayerThreshold: 0.75,
            },
          );

          // partitionKey = `${grade}:${abilityBucket}`;
          partitionKey = `${grade}:medium`;
          socket.data.quizPartitionKey = partitionKey;

          // Lưu context để factory dùng khi tạo session
          await setPendingContext(userId, {
            displayName: data.displayName ?? userId,
            grade,
            abilityBucket,
          });
        }

        // ---- Thông số ghép trận (timeout / mốc bot / mode) lấy từ config ----
        const timing = await GameConfigService.getMatchmakingTiming(gameType);

        // Chế độ 'bot_only': cô lập user vào partition riêng để KHÔNG bao giờ
        // ghép được người thật, nhưng vẫn tái dùng toàn bộ cơ chế queue / timeout /
        // disconnect-cleanup hiện có. Partition này chỉ chứa chính user đó.
        let effectivePartitionKey = partitionKey;
        if (timing.opponentMode === 'bot_only') {
          effectivePartitionKey = `bot-only:${userId}`;
          // Lưu lại để LEAVE & disconnect dùng đúng partition khi dọn entry
          socket.data.quizPartitionKey = effectivePartitionKey;
        }

        const result = await MatchmakingService.joinQueue({
          userId,
          gameType,
          joinedAt: Date.now(),
          socketId: socket.id,
          partitionKey: effectivePartitionKey,
        });

        if (result.status === 'matched') {
          // Clear timeout của opponent (nếu có) — opponent đã được ghép, không cần AI fallback nữa
          if (result.opponentId) {
            await clearMatchmakingTimeout(result.opponentId, gameType);
          }

          // Đánh dấu cả 2 player đang trong session active
          await Promise.all([
            MatchmakingService.setActiveSession(userId, result.sessionId!, gameType),
            MatchmakingService.setActiveSession(result.opponentId!, result.sessionId!, gameType),
          ]);

          const opponentSocketId = await getOpponentSocketId(io, result.opponentId!);

          socket.emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED, {
            ...result,
            role: 'second',
          });

          if (opponentSocketId) {
            const me = await UserService.getUser(userId);
            io.to(opponentSocketId).emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED, {
              ...result,
              opponentId: userId,
              role: 'first',
              opponentProfile: {
                name: me?.name ?? '',
                avatar: me?.avatar,
              },
            });
          }

          // Join room — opponent có thể nằm trên instance khác nên phải dùng
          // remote join qua Redis adapter (io.sockets.sockets.get chỉ thấy socket local)
          socket.join(result.sessionId!);
          if (opponentSocketId) {
            io.in(opponentSocketId).socketsJoin(result.sessionId!);
          }
        } else if (result.status === 'searching') {
          // Clear timeout cũ nếu có (tránh duplicate)
          await clearMatchmakingTimeout(userId, gameType);

          // displayTimeout = tổng thời gian tìm trận, hiển thị cho user (progress ring).
          // Client chỉ phản ứng theo event matched/timeout do server phát, nên việc
          // bot được ghép SỚM hơn displayTimeout là bình thường và đúng yêu cầu.
          socket.emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED, {
            status: 'searching',
            gameType,
            timeout: timing.matchmakingTimeout,
          });

          // Thời điểm ghép bot là NGẪU NHIÊN (không cố định ở mốc cuối):
          // - mixed:    random trong nửa sau [botActivationSeconds, matchmakingTimeout]
          //             → 0 → botActivationSeconds chỉ tìm người thật.
          // - bot_only: random trong toàn bộ [0, matchmakingTimeout].
          const botDelaySeconds =
            timing.opponentMode === 'bot_only'
              ? randomBotDelaySeconds(0, timing.matchmakingTimeout)
              : randomBotDelaySeconds(timing.botActivationSeconds, timing.matchmakingTimeout);

          await TimerQueueService.scheduleMatchmakingTimeout({
            userId,
            gameType,
            partitionKey: effectivePartitionKey,
            socketId: socket.id,
          }, botDelaySeconds * 1000);
        }
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    },
  );

  // ============================================================
  // Leave matchmaking
  // ============================================================

  socket.on(
    MATCHMAKING_SOCKET_EVENTS.LEAVE_MATCHMAKING,
    async (data: { userId: string; gameType: MatchmakingGameType }) => {
      try {
        const userId = data.userId != null ? String(data.userId) : '';
        await clearMatchmakingTimeout(userId, data.gameType);
        const storedPartitionKey = socket.data.quizPartitionKey;
        await MatchmakingService.leaveQueue(userId, data.gameType, storedPartitionKey);
        socket.emit(MATCHMAKING_SOCKET_EVENTS.LEAVE_MATCHMAKING, { success: true });
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    },
  );

  // ============================================================
  // Disconnect — cleanup
  // ============================================================

  socket.on('disconnect', async () => {
    try {
      const userId: string | undefined = socket.data.userId;
      const gameType: MatchmakingGameType | undefined = socket.data.gameType;
      if (userId && gameType) {
        const storedPartitionKey = socket.data.quizPartitionKey;
        // Chỉ dọn entry thuộc đúng socket này. Khi user reload, socket cũ
        // disconnect MUỘN (sau pingTimeout) — nếu xóa theo userId sẽ xóa nhầm
        // entry + timeout job của phiên search mới, làm user kẹt "searching" mãi.
        const removed = await MatchmakingService.leaveQueue(
          userId,
          gameType,
          storedPartitionKey,
          socket.id,
        );
        if (removed) {
          await clearMatchmakingTimeout(userId, gameType);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}

/** Tìm socketId của opponent từ userId */
async function getOpponentSocketId(io: Server, userId: string): Promise<string | undefined> {
  return SocketRegistry.getSocketId(userId);
}

/**
 * Chọn ngẫu nhiên thời điểm (giây) ghép bot trong khoảng [minSec, maxSec].
 * Clamp tối thiểu 1s để màn "đang tìm" luôn hiển thị một nhịp trước khi vào trận bot
 * (tránh trường hợp delay = 0 khiến cảm giác như vào thẳng trận).
 */
function randomBotDelaySeconds(minSec: number, maxSec: number): number {
  const lo = Math.max(0, Math.min(minSec, maxSec));
  const hi = Math.max(lo, maxSec);
  const delay = lo + Math.random() * (hi - lo);
  return Math.max(1, Math.round(delay));
}
