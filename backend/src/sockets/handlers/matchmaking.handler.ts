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

/**
 * Lưu timeout handle cho mỗi user đang chờ matchmaking.
 * Key: `${userId}:${gameType}`
 * Dùng để clear timeout khi user được ghép trận hoặc rời queue.
 */
const timeoutMap = new Map<string, NodeJS.Timeout>();
/** Lưu partitionKey theo userId:gameType để dùng khi leaveQueue hoặc timeout */
const partitionKeyMap = new Map<string, string | undefined>();

function timeoutKey(userId: string, gameType: MatchmakingGameType): string {
  return `${userId}:${gameType}`;
}

function clearMatchmakingTimeout(userId: string, gameType: MatchmakingGameType): void {
  const key = timeoutKey(userId, gameType);
  const handle = timeoutMap.get(key);
  if (handle) {
    clearTimeout(handle);
    timeoutMap.delete(key);
  }
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
        const { userId, gameType } = data;
        if (!userId || !gameType) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'userId and gameType are required' });
          return;
        }

        // ---- Guard: chặn join queue nếu user đang trong session active ----
        const activeSession = await MatchmakingService.getActiveSession(userId);
        if (activeSession) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: `Bạn đang trong một trận đấu đang diễn ra (${activeSession.gameType}). Vui lòng hoàn thành hoặc rời trận trước khi tìm trận mới.`,
            code: 'ACTIVE_SESSION_EXISTS',
            activeSessionId: activeSession.sessionId,
            activeGameType: activeSession.gameType,
          });
          return;
        }

        socket.data.userId = userId;
        socket.data.gameType = gameType;

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

        partitionKeyMap.set(timeoutKey(userId, gameType), partitionKey);

        const result = await MatchmakingService.joinQueue({
          userId,
          gameType,
          joinedAt: Date.now(),
          socketId: socket.id,
          partitionKey,
        });

        if (result.status === 'matched') {
          // Clear timeout của opponent (nếu có) — opponent đã được ghép, không cần AI fallback nữa
          if (result.opponentId) {
            clearMatchmakingTimeout(result.opponentId, gameType);
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
            io.to(opponentSocketId).emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED, {
              ...result,
              opponentId: userId,
              role: 'first',
            });
          }

          // Join room
          socket.join(result.sessionId!);
          if (opponentSocketId) {
            const opponentSocket = io.sockets.sockets.get(opponentSocketId);
            opponentSocket?.join(result.sessionId!);
          }
        } else if (result.status === 'searching') {
          // Clear timeout cũ nếu có (tránh duplicate)
          clearMatchmakingTimeout(userId, gameType);

          // Quiz Arena: 
          // - displayTimeout: tổng thời gian tìm trận (hiển thị cho user)
          // - botTriggerTimeout: thời điểm kích hoạt bot (internal)
          // Các game khác: dùng matchmakingTimeout cho cả hai
          let displayTimeoutSeconds: number;
          let botTriggerTimeoutSeconds: number;
          
          if (gameType === 'quiz') {
            const quizConfig = await GameConfigService.getQuizArenaConfig().catch(() => null);
            displayTimeoutSeconds = quizConfig?.matchmakingTimeout ?? 30;
            botTriggerTimeoutSeconds = quizConfig?.botActivationSeconds ?? 15;
          } else {
            displayTimeoutSeconds = await getMatchmakingTimeout(gameType);
            botTriggerTimeoutSeconds = displayTimeoutSeconds;
          }

          socket.emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED, {
            status: 'searching',
            gameType,
            timeout: displayTimeoutSeconds,
          });

          const handle = setTimeout(async () => {
            timeoutMap.delete(timeoutKey(userId, gameType));

            const storedPartitionKey = partitionKeyMap.get(timeoutKey(userId, gameType));
            const timeoutResult = await MatchmakingService.handleTimeout(
              userId,
              gameType,
              'medium',
              storedPartitionKey,
            );
            if (timeoutResult && timeoutResult.status === 'timeout') {
              // Đánh dấu user đang trong session active (AI)
              await MatchmakingService.setActiveSession(userId, timeoutResult.sessionId!, gameType);

              socket.emit(MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_TIMEOUT, {
                sessionId: timeoutResult.sessionId,
                gameType,
                isAI: true,
                aiDifficulty: timeoutResult.aiDifficulty,
                opponentProfile: timeoutResult.opponentProfile,
              });
              socket.join(timeoutResult.sessionId!);
            }
          }, botTriggerTimeoutSeconds * 1000);

          timeoutMap.set(timeoutKey(userId, gameType), handle);
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
        clearMatchmakingTimeout(data.userId, data.gameType);
        const storedPartitionKey = partitionKeyMap.get(timeoutKey(data.userId, data.gameType));
        partitionKeyMap.delete(timeoutKey(data.userId, data.gameType));
        await MatchmakingService.leaveQueue(data.userId, data.gameType, storedPartitionKey);
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
        clearMatchmakingTimeout(userId, gameType);
        const storedPartitionKey = partitionKeyMap.get(timeoutKey(userId, gameType));
        partitionKeyMap.delete(timeoutKey(userId, gameType));
        await MatchmakingService.leaveQueue(userId, gameType, storedPartitionKey);
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}

/** Tìm socketId của opponent từ userId */
async function getOpponentSocketId(io: Server, userId: string): Promise<string | undefined> {
  const sockets = await io.fetchSockets();
  for (const s of sockets) {
    if (s.data.userId === userId) {
      return s.id;
    }
  }
  return undefined;
}

/** Lấy matchmaking timeout từ config của game, fallback về default */
async function getMatchmakingTimeout(gameType: MatchmakingGameType): Promise<number> {
  return GameConfigService.getMatchmakingTimeout(gameType);
}
