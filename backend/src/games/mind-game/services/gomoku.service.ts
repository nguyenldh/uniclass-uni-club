// ============================================================
// Mind Game — Gomoku Service
// ============================================================

import type { Server } from 'socket.io';
import { redis } from '../../../config/index';
import { GameConfigService } from '../../../services/game-config.service';
import { ScoreService } from '../../../services/score.service';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { BotProfileService } from '../../../services/bot-profile.service';
import { GameResultEventService } from '../../../services/game-result-event.service';
import { TimerQueueService } from '../../../services/timer-queue.service';
import { generateSessionId } from '../../../utils/index';
import { withRedisLock } from '../../../utils/redis-lock';
import { createEmptyBoard, checkGomokuWin, isBoardFull } from '../utils/index';
import { MIND_GAME_REDIS_KEYS, MIND_GAME_SOCKET_EVENTS } from '@uniclub/shared';
import type {
  GomokuSession,
  GomokuMove,
  GomokuResult,
  AIDifficulty,
} from '@uniclub/shared';
import { UserService } from '../../../services';

/** Thời gian chờ reconnect trước khi kết thúc trận (giây) */
const DISCONNECT_GRACE_SECONDS = 30;

/**
 * Distributed lock key per-session — serialize mọi thao tác get→mutate→set
 * (move, timeout, disconnect) xuyên instance, chống lost update làm
 * mất nước đi / không chuyển lượt.
 */
function sessionLockKey(sessionId: string): string {
  return `lock:${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${sessionId}`;
}

export class GomokuService {
  // ---- Timer helpers ----
  // Timer chạy qua BullMQ (Redis) thay vì setTimeout in-memory:
  // bất kỳ instance nào cũng schedule/cancel/reset được, và timer
  // không bị mất khi instance restart.

  /** Bắt đầu turn timer cho lượt hiện tại (reset nếu đã có) */
  private static async startTurnTimer(sessionId: string, turnTimeoutSec: number): Promise<void> {
    await TimerQueueService.scheduleMindGameTurnTimeout('gomoku', sessionId, turnTimeoutSec * 1000);
  }

  /** Xóa turn timer */
  private static async clearTurnTimer(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameTurnTimeout('gomoku', sessionId);
  }

  /** Bắt đầu game timer cho toàn bộ trận */
  private static async startGameTimer(sessionId: string, maxDurationSec: number): Promise<void> {
    await TimerQueueService.scheduleMindGameGameTimeout('gomoku', sessionId, maxDurationSec * 1000);
  }

  /** Xóa game timer */
  private static async clearGameTimer(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameGameTimeout('gomoku', sessionId);
  }

  /** Xóa tất cả timer của session */
  private static async clearAllTimers(sessionId: string): Promise<void> {
    await Promise.all([
      this.clearTurnTimer(sessionId),
      this.clearGameTimer(sessionId),
      TimerQueueService.cancelMindGameDisconnectGrace('gomoku', sessionId),
    ]);
  }

  /**
   * Xử lý khi hết thời gian lượt → forfeit, đối thủ thắng.
   * Được gọi từ BullMQ worker (có thể trên instance bất kỳ).
   */
  static async handleTurnTimeout(sessionId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'playing') return;

      const currentPlayer = session.currentTurn === 'X' ? session.playerX : session.playerO;
      const winnerId = session.isAI
        ? 'AI'
        : (session.playerX === currentPlayer ? session.playerO : session.playerX);

      session.status = 'finished';
      session.endedAt = new Date();
      session.winner = winnerId;

      if (!session.isAI) {
        await ScoreService.addWinPoints(winnerId, session.config.winPoints, 'mind_game', 'gomoku');
      }
      await ScoreService.recordLoss(currentPlayer, 'mind_game', 'gomoku');

      await MatchmakingService.clearActiveSession(currentPlayer);
      if (!session.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await this.clearAllTimers(sessionId);
      await this.saveSession(session);

      await GameResultEventService.emitGomokuResult(session, winnerId, false);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
        winner: winnerId,
        isDraw: false,
        reason: 'turn_timeout',
      });
    });
  }

  /**
   * Xử lý khi hết thời gian toàn bộ trận → hòa.
   * Được gọi từ BullMQ worker (có thể trên instance bất kỳ).
   */
  static async handleGameTimeout(sessionId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'playing') return;

      session.status = 'finished';
      session.endedAt = new Date();

      await this.clearAllTimers(sessionId);

      await MatchmakingService.clearActiveSession(session.playerX);
      if (!session.isAI) {
        await MatchmakingService.clearActiveSession(session.playerO);
      }

      await this.saveSession(session);

      await GameResultEventService.emitGomokuResult(session, undefined, true);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
        winner: null,
        isDraw: true,
        reason: 'game_timeout',
      });
    });
  }

  // ---- Session lifecycle ----

  /** Tạo session PvP */
  static async createPVPSession(
    playerX: string,
    playerO: string,
  ): Promise<GomokuSession> {
    const config = await GameConfigService.getGomokuConfig();
    const sessionId = generateSessionId();

    const session: GomokuSession = {
      sessionId,
      playerX,
      playerO,
      board: createEmptyBoard(config.boardSize),
      currentTurn: 'X',
      status: 'playing',
      isAI: false,
      config,
      startedAt: new Date(),
      moveCount: 0,
    };

    await redis.set(
      `${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${sessionId}`,
      JSON.stringify(session),
      'EX',
      1800,
    );

    // Khởi tạo timers
    await this.startTurnTimer(sessionId, config.turnTimeout);
    await this.startGameTimer(sessionId, config.maxGameDuration);

    return session;
  }

  /** Tạo session vs AI. Trả về session và botProfile để hiển thị nhất quán. */
  static async createAISession(
    userId: string,
    difficulty: AIDifficulty = 'medium',
  ): Promise<{ session: GomokuSession; botProfile?: { name: string; avatar?: string } }> {
    const config = await GameConfigService.getGomokuConfig();
    const sessionId = generateSessionId();

    // Lấy bot identity (name + avatar) từ pool
    const botIdentity = await BotProfileService.getRandomBot();
    const botName = botIdentity?.name ?? 'Bot AI';
    const botAvatar = botIdentity?.avatar;

    const session: GomokuSession = {
      sessionId,
      playerX: userId,
      playerO: 'AI',
      board: createEmptyBoard(config.boardSize),
      currentTurn: 'X',
      status: 'playing',
      isAI: true,
      aiDifficulty: difficulty,
      aiName: botName,
      aiAvatar: botAvatar,
      config,
      startedAt: new Date(),
      moveCount: 0,
    };

    await redis.set(
      `${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${sessionId}`,
      JSON.stringify(session),
      'EX',
      1800,
    );

    // Khởi tạo timers
    await this.startTurnTimer(sessionId, config.turnTimeout);
    await this.startGameTimer(sessionId, config.maxGameDuration);

    return { session, botProfile: { name: botName, avatar: botAvatar } };
  }

  /** Lấy session */
  static async getSession(sessionId: string): Promise<GomokuSession | null> {
    const data = await redis.get(`${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${sessionId}`);
    if (!data) return null;
    const sessionData = JSON.parse(data);
    // get Player Data

    if (sessionData.playerX === 'AI') {
      sessionData.playerXData = {
        name: sessionData.aiName,
        avatar: sessionData.aiAvatar,
      };
    } else {
      const playerXInfo = await UserService.getUser(sessionData.playerX);
      sessionData.playerXData = {
        name: playerXInfo?.name ?? 'Unknown',
        avatar: playerXInfo?.avatar,
      };
    }

    if (sessionData.playerO === 'AI') {
      sessionData.playerOData = {
        name: sessionData.aiName,
        avatar: sessionData.aiAvatar,
      };
    } else {
      const playerOInfo = await UserService.getUser(sessionData.playerO);
      sessionData.playerOData = {
        name: playerOInfo?.name ?? 'Unknown',
        avatar: playerOInfo?.avatar,
      };
    }

    return sessionData;
  }

  /** Lưu session */
  static async saveSession(session: GomokuSession): Promise<void> {
    await redis.set(
      `${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${session.sessionId}`,
      JSON.stringify(session),
      'EX',
      1800,
    );
  }

  /** Xóa session */
  static async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`${MIND_GAME_REDIS_KEYS.GOMOKU_SESSION}:${sessionId}`);
  }

  /** Xử lý nước đi (distributed lock per-session — chống 2 move ghi đè nhau) */
  static async makeMove(
    sessionId: string,
    userId: string,
    row: number,
    col: number,
  ): Promise<{
    session: GomokuSession;
    gameOver: boolean;
    winner?: string;
  }> {
    return withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status !== 'playing') throw new Error('Game is not active');
      if (userId !== session.playerX && userId !== session.playerO) {
        throw new Error('Not a player in this session');
      }

      const playerSymbol = session.playerX === userId ? 'X' : 'O';
      if (session.currentTurn !== playerSymbol) throw new Error('Not your turn');
      if (session.board[row][col] !== null) throw new Error('Cell is not empty');

      session.board[row][col] = playerSymbol;
      const move: GomokuMove = {
        player: userId,
        symbol: playerSymbol,
        row,
        col,
        timestamp: new Date(),
      };
      session.lastMove = move;
      session.moveCount++;

      if (checkGomokuWin(session.board, row, col, playerSymbol)) {
        session.status = 'finished';
        session.winner = userId;
        session.endedAt = new Date();
        session.winningMove = move;

        // Clear all timers
        await this.clearAllTimers(sessionId);

        // Chỉ lưu điểm cho người chơi thật, không lưu cho AI
        if (!session.isAI || userId === session.playerX) {
          await ScoreService.addWinPoints(userId, session.config.winPoints, 'mind_game', 'gomoku');
        }

        if (!session.isAI) {
          const loserId = session.playerX === userId ? session.playerO : session.playerX;
          await ScoreService.recordLoss(loserId, 'mind_game', 'gomoku');
          await MatchmakingService.clearActiveSession(loserId);
        } else if (userId === session.playerO) {
          // AI thắng → ghi nhận thua cho người chơi (playerX)
          await ScoreService.recordLoss(session.playerX, 'mind_game', 'gomoku');
          await MatchmakingService.clearActiveSession(session.playerX);
        }

        // Clear active session tracking (chỉ clear nếu userId là người chơi thật)
        if (!session.isAI || userId === session.playerX) {
          await MatchmakingService.clearActiveSession(userId);
        }

        await this.saveSession(session);

        // Emit Kafka event for UniClass integration
        await GameResultEventService.emitGomokuResult(session, userId, false);

        return { session, gameOver: true, winner: userId };
      }

      if (isBoardFull(session.board)) {
        session.status = 'finished';
        session.endedAt = new Date();

        // Clear all timers
        await this.clearAllTimers(sessionId);

        // Clear active session tracking (hòa)
        await MatchmakingService.clearActiveSession(session.playerX);
        if (!session.isAI) {
          await MatchmakingService.clearActiveSession(session.playerO);
        }

        await this.saveSession(session);

        // Emit Kafka event for draw
        await GameResultEventService.emitGomokuResult(session, undefined, true);

        return { session, gameOver: true };
      }

      session.currentTurn = session.currentTurn === 'X' ? 'O' : 'X';
      await this.saveSession(session);

      // Reset turn timer cho lượt mới
      await this.startTurnTimer(sessionId, session.config.turnTimeout);

      return { session, gameOver: false };
    });
  }

  /**
   * Xử lý người chơi disconnect — schedule grace period 30s qua BullMQ
   * (instance nào cũng cancel được khi user reconnect).
   */
  static async handleDisconnect(
    sessionId: string,
    userId: string,
  ): Promise<GomokuResult | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'playing') return null;

    // Schedule thay thế timer cũ nếu có (cùng jobId)
    await TimerQueueService.scheduleMindGameDisconnectGrace(
      'gomoku',
      sessionId,
      userId,
      DISCONNECT_GRACE_SECONDS * 1000,
    );

    return null; // Chưa kết thúc, đang chờ reconnect
  }

  /**
   * Hết grace period mà user chưa reconnect → kết thúc trận, đối thủ thắng.
   * Được gọi từ BullMQ worker.
   */
  static async handleDisconnectGrace(sessionId: string, userId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const currentSession = await this.getSession(sessionId);
      if (!currentSession || currentSession.status !== 'playing') return;

      const winnerId = currentSession.isAI
        ? 'AI'
        : (currentSession.playerX === userId ? currentSession.playerO : currentSession.playerX);
      const loserId = userId;

      // Kết thúc trận — đối thủ thắng
      currentSession.status = 'finished';
      currentSession.endedAt = new Date();
      currentSession.winner = winnerId;

      // Clear all timers
      await this.clearAllTimers(sessionId);

      if (!currentSession.isAI) {
        await ScoreService.addWinPoints(winnerId, currentSession.config.winPoints, 'mind_game', 'gomoku');
      }
      await ScoreService.recordLoss(loserId, 'mind_game', 'gomoku');

      // Clear active session tracking
      await MatchmakingService.clearActiveSession(loserId);
      if (!currentSession.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await this.saveSession(currentSession);

      // Emit Kafka event for forfeit
      await GameResultEventService.emitGomokuResult(currentSession, winnerId, false);

      // Emit END event qua socket để người còn lại biết
      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
        winner: winnerId,
        isDraw: false,
        reason: 'opponent_disconnected',
      });
    });
  }

  /**
   * Xử lý khi user reconnect sau khi bị disconnect.
   * Cancel disconnect grace job (cross-instance qua BullMQ).
   */
  static async handleReconnect(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameDisconnectGrace('gomoku', sessionId);
  }
}
