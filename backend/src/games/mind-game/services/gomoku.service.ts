// ============================================================
// Mind Game — Gomoku Service
// ============================================================

import { redis } from '../../../config/index';
import { GameConfigService } from '../../../services/game-config.service';
import { ScoreService } from '../../../services/score.service';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { BotProfileService } from '../../../services/bot-profile.service';
import { GameResultEventService } from '../../../services/game-result-event.service';
import { generateSessionId } from '../../../utils/index';
import { createEmptyBoard, checkGomokuWin, isBoardFull } from '../utils/index';
import { MIND_GAME_REDIS_KEYS } from '@uniclub/shared';
import type {
  GomokuSession,
  GomokuMove,
  GomokuResult,
  AIDifficulty,
} from '@uniclub/shared';
import { UserService } from '../../../services';

/**
 * Map: sessionId → handle timeout kết thúc trận khi user disconnect.
 * Cho user 30s để reconnect trước khi end match.
 */
const disconnectTimers = new Map<string, NodeJS.Timeout>();

/** Thời gian chờ reconnect trước khi kết thúc trận (giây) */
const DISCONNECT_GRACE_SECONDS = 30;

/** Server IO instance - được set từ socket handler để emit event sau timeout */
let serverIO: import('socket.io').Server | null = null;

/** Set server IO instance */
export function setGomokuServerIO(io: import('socket.io').Server): void {
  serverIO = io;
}

export class GomokuService {
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

  /** Xử lý nước đi */
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
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'playing') throw new Error('Game is not active');

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

    return { session, gameOver: false };
  }

  /** Xử lý người chơi disconnect */
  static async handleDisconnect(
    sessionId: string,
    userId: string,
  ): Promise<GomokuResult | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'playing') return null;

    // Cả AI và PvP đều có grace period 30s
    const existingTimer = disconnectTimers.get(sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    const winnerId = session.isAI ? 'AI' : (session.playerX === userId ? session.playerO : session.playerX);
    const loserId = userId;

    const timer = setTimeout(async () => {
      disconnectTimers.delete(sessionId);
      // Kiểm tra lại session
      const currentSession = await GomokuService.getSession(sessionId);
      if (!currentSession || currentSession.status !== 'playing') return;

      // Kết thúc trận — đối thủ thắng
      currentSession.status = 'finished';
      currentSession.endedAt = new Date();
      currentSession.winner = winnerId;

      if (!currentSession.isAI) {
        await ScoreService.addWinPoints(winnerId, currentSession.config.winPoints, 'mind_game', 'gomoku');
      }
      await ScoreService.recordLoss(loserId, 'mind_game', 'gomoku');

      // Clear active session tracking
      await MatchmakingService.clearActiveSession(loserId);
      if (!currentSession.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await GomokuService.saveSession(currentSession);

      // Emit Kafka event for forfeit
      await GameResultEventService.emitGomokuResult(currentSession, winnerId, false);

      // Emit END event qua socket để người còn lại biết
      if (serverIO) {
        const { MIND_GAME_SOCKET_EVENTS } = await import('@uniclub/shared');
        serverIO.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
          winner: winnerId,
          isDraw: false,
          reason: 'opponent_disconnected',
        });
      }
    }, DISCONNECT_GRACE_SECONDS * 1000);

    disconnectTimers.set(sessionId, timer);
    return null; // Chưa kết thúc, đang chờ reconnect
  }

  /**
   * Xử lý khi user reconnect sau khi bị disconnect.
   * Clear disconnect timer.
   */
  static handleReconnect(sessionId: string): void {
    const timer = disconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(sessionId);
    }
  }
}
