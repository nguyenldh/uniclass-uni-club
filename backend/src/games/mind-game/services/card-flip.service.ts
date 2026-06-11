// ============================================================
// Mind Game — Card Flip Service (Lật thẻ PvP)
// ============================================================

import type { Server } from 'socket.io';
import { redis } from '../../../config/index';
import { GameConfigService } from '../../../services/game-config.service';
import { ScoreService } from '../../../services/score.service';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { BotProfileService } from '../../../services/bot-profile.service';
import { GameResultEventService } from '../../../services/game-result-event.service';
import { TimerQueueService } from '../../../services/timer-queue.service';
import { generateSessionId, shuffle } from '../../../utils/index';
import { withRedisLock } from '../../../utils/redis-lock';
import { MIND_GAME_REDIS_KEYS, MIND_GAME_SOCKET_EVENTS, CARD_EMOJIS } from '@uniclub/shared';
import type {
  CardFlipSession,
  CardFlipCard,
  CardFlipResult,
  AIDifficulty,
} from '@uniclub/shared';
import { UserService } from '../../../services';

/** Thời gian chờ reconnect trước khi kết thúc trận (giây) */
const DISCONNECT_GRACE_SECONDS = 30;

/**
 * Distributed lock key per-session — serialize flip/reset/timeout xuyên instance.
 * Mutex in-process trước đây không bảo vệ được khi 2 request rơi vào
 * 2 instance khác nhau (hoặc 1 qua REST, 1 qua socket).
 */
function sessionLockKey(sessionId: string): string {
  return `lock:${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`;
}

export class CardFlipService {
  // ---- Timer helpers ----
  // Timer chạy qua BullMQ (Redis) thay vì setTimeout in-memory —
  // cancel/reset được từ bất kỳ instance nào, không mất khi restart.

  /** Bắt đầu turn timer cho lượt hiện tại (reset nếu đã có) */
  private static async startTurnTimer(sessionId: string, turnTimeoutSec: number): Promise<void> {
    await TimerQueueService.scheduleMindGameTurnTimeout('card_flip', sessionId, turnTimeoutSec * 1000);
  }

  /** Xóa turn timer */
  private static async clearTurnTimer(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameTurnTimeout('card_flip', sessionId);
  }

  /** Bắt đầu game timer cho toàn bộ trận */
  private static async startGameTimer(sessionId: string, maxDurationSec: number): Promise<void> {
    await TimerQueueService.scheduleMindGameGameTimeout('card_flip', sessionId, maxDurationSec * 1000);
  }

  /** Xóa game timer */
  private static async clearGameTimer(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameGameTimeout('card_flip', sessionId);
  }

  /** Xóa tất cả timer của session */
  private static async clearAllTimers(sessionId: string): Promise<void> {
    await Promise.all([
      this.clearTurnTimer(sessionId),
      this.clearGameTimer(sessionId),
      TimerQueueService.cancelMindGameDisconnectGrace('card_flip', sessionId),
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

      const currentPlayer = session.currentTurn;
      const winnerId = session.isAI
        ? 'AI'
        : (session.playerA === currentPlayer ? session.playerB : session.playerA);

      session.status = 'finished';
      session.endedAt = new Date();

      if (!session.isAI) {
        await ScoreService.addWinPoints(winnerId, session.config.winPoints, 'mind_game', 'card_flip');
      }
      await ScoreService.recordLoss(currentPlayer, 'mind_game', 'card_flip');

      await MatchmakingService.clearActiveSession(currentPlayer);
      if (!session.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await this.clearAllTimers(sessionId);
      await this.saveSession(session);

      await GameResultEventService.emitCardFlipResult(session, winnerId, false);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
        winner: winnerId,
        isDraw: false,
        reason: 'turn_timeout',
      });
    });
  }

  /**
   * Xử lý khi hết thời gian toàn bộ trận → người điểm cao thắng / hòa.
   * Được gọi từ BullMQ worker (có thể trên instance bất kỳ).
   */
  static async handleGameTimeout(sessionId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'playing') return;

      session.status = 'finished';
      session.endedAt = new Date();

      const playerAScore = session.scores.playerA;
      const playerBScore = session.scores.playerB;
      let winnerId: string | undefined;

      if (playerAScore > playerBScore) {
        winnerId = session.playerA;
        await ScoreService.addWinPoints(session.playerA, session.config.winPoints, 'mind_game', 'card_flip');
        if (!session.isAI) {
          await ScoreService.recordLoss(session.playerB, 'mind_game', 'card_flip');
        }
      } else if (playerBScore > playerAScore) {
        winnerId = session.isAI ? 'AI' : session.playerB;
        if (!session.isAI) {
          await ScoreService.addWinPoints(session.playerB, session.config.winPoints, 'mind_game', 'card_flip');
          await ScoreService.recordLoss(session.playerA, 'mind_game', 'card_flip');
        } else {
          await ScoreService.recordLoss(session.playerA, 'mind_game', 'card_flip');
        }
      }
      // Hòa: không cộng điểm ai cả

      await this.clearAllTimers(sessionId);

      await MatchmakingService.clearActiveSession(session.playerA);
      if (!session.isAI) {
        await MatchmakingService.clearActiveSession(session.playerB);
      }

      await this.saveSession(session);

      await GameResultEventService.emitCardFlipResult(session, winnerId, !winnerId);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
        winner: winnerId ?? null,
        isDraw: !winnerId,
        reason: 'game_timeout',
      });
    });
  }

  // ---- Session lifecycle ----

  /** Tạo session PvP */
  static async createPVPSession(
    playerA: string,
    playerB: string,
  ): Promise<CardFlipSession> {
    const config = await GameConfigService.getCardFlipConfig();
    const sessionId = generateSessionId();
    const cards = this.generateCards(config.pairCount, config.cardItems);

    const session: CardFlipSession = {
      sessionId,
      playerA,
      playerB,
      cards,
      currentTurn: playerA, // playerA đi trước
      scores: { playerA: 0, playerB: 0 },
      status: 'playing',
      isAI: false,
      config,
      startedAt: new Date(),
      lastFlipped: [],
      consecutivePairsA: 0,
      consecutivePairsB: 0,
      maxConsecutivePairsA: 0,
      maxConsecutivePairsB: 0,
    };

    await redis.set(
      `${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`,
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
  ): Promise<{ session: CardFlipSession; botProfile?: { name: string; avatar?: string } }> {
    const config = await GameConfigService.getCardFlipConfig();
    const sessionId = generateSessionId();
    const cards = this.generateCards(config.pairCount, config.cardItems);

    // Lấy bot identity (name + avatar) từ pool
    const botIdentity = await BotProfileService.getRandomBot();
    const botName = botIdentity?.name ?? 'Bot AI';
    const botAvatar = botIdentity?.avatar;

    const session: CardFlipSession = {
      sessionId,
      playerA: userId,
      playerB: 'AI',
      cards,
      currentTurn: userId, // Người chơi luôn đi trước
      scores: { playerA: 0, playerB: 0 },
      status: 'playing',
      isAI: true,
      aiDifficulty: difficulty,
      aiName: botName,
      aiAvatar: botAvatar,
      config,
      startedAt: new Date(),
      lastFlipped: [],
      consecutivePairsA: 0,
      consecutivePairsB: 0,
      maxConsecutivePairsA: 0,
      maxConsecutivePairsB: 0,
    };

    await redis.set(
      `${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`,
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
  static async getSession(sessionId: string): Promise<CardFlipSession | null> {
    const data = await redis.get(`${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`);
    if (!data) return null;
    const sessionData = JSON.parse(data);

    // get Player Data
    if (sessionData.playerA !== 'AI') {
      sessionData.playerAData = await UserService.getUser(sessionData.playerA);
    } else {
      sessionData.playerAData = { name: sessionData.aiName, avatar: sessionData.aiAvatar };
    }

    if (sessionData.playerB !== 'AI') {
      sessionData.playerBData = await UserService.getUser(sessionData.playerB);
    } else {
      sessionData.playerBData = { name: sessionData.aiName, avatar: sessionData.aiAvatar };
    }

    return sessionData;
  }

  /** Lưu session */
  static async saveSession(session: CardFlipSession): Promise<void> {
    await redis.set(
      `${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${session.sessionId}`,
      JSON.stringify(session),
      'EX',
      1800,
    );
  }

  /** Xóa session */
  static async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`);
  }

  /** Xử lý lật thẻ (distributed lock per-session chống race condition xuyên instance) */
  static async flipCard(
    sessionId: string,
    userId: string,
    cardId: number,
  ): Promise<{
    session: CardFlipSession;
    isMatch: boolean;
    gameOver: boolean;
    winner?: string;
  }> {
    return withRedisLock(sessionLockKey(sessionId), async () => {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'playing') throw new Error('Game is not active');
    if (session.currentTurn !== userId) throw new Error('Not your turn');

    const card = session.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('Invalid card');
    if (card.matched || card.flipped) throw new Error('Card already revealed');

    // Chặn lật quá 2 thẻ trong 1 lượt (phòng thủ server-side)
    if (session.lastFlipped.length >= 2) throw new Error('Already flipped 2 cards this turn');

    // Flip card
    card.flipped = true;
    session.lastFlipped.push(cardId);

    // Nếu mới lật thẻ đầu tiên trong lượt
    if (session.lastFlipped.length === 1) {
      await this.saveSession(session);
      return { session, isMatch: false, gameOver: false };
    }

    // Đã lật 2 thẻ — kiểm tra match
    const [firstId, secondId] = session.lastFlipped;
    const firstCard = session.cards.find((c) => c.id === firstId)!;
    const secondCard = session.cards.find((c) => c.id === secondId)!;

    const isMatch = firstCard.value === secondCard.value;

    if (isMatch) {
      // Match! Cộng điểm, giữ lượt
      firstCard.matched = true;
      secondCard.matched = true;

      if (userId === session.playerA) {
        session.scores.playerA++;
        // Track consecutive pairs
        session.consecutivePairsA++;
        if (session.consecutivePairsA > session.maxConsecutivePairsA) {
          session.maxConsecutivePairsA = session.consecutivePairsA;
        }
      } else {
        session.scores.playerB++;
        // Track consecutive pairs
        session.consecutivePairsB++;
        if (session.consecutivePairsB > session.maxConsecutivePairsB) {
          session.maxConsecutivePairsB = session.consecutivePairsB;
        }
      }

      session.lastFlipped = [];

      // Kiểm tra game over
      const allMatched = session.cards.every((c) => c.matched);
      if (allMatched) {
        session.status = 'finished';
        session.endedAt = new Date();

        // Clear all timers
        await this.clearAllTimers(sessionId);

        const playerAScore = session.scores.playerA;
        const playerBScore = session.scores.playerB;

        if (playerAScore > playerBScore) {
          // playerA thắng
          await ScoreService.addWinPoints(session.playerA, session.config.winPoints, 'mind_game', 'card_flip');
          if (!session.isAI) {
            await ScoreService.recordLoss(session.playerB, 'mind_game', 'card_flip');
          }
        } else if (playerBScore > playerAScore) {
          // playerB thắng
          if (!session.isAI) {
            await ScoreService.addWinPoints(session.playerB, session.config.winPoints, 'mind_game', 'card_flip');
            await ScoreService.recordLoss(session.playerA, 'mind_game', 'card_flip');
          } else {
            await ScoreService.recordLoss(session.playerA, 'mind_game', 'card_flip');
          }
        }
        // Hòa: không cộng điểm ai cả

        // Clear active session tracking
        await MatchmakingService.clearActiveSession(session.playerA);
        if (!session.isAI) {
          await MatchmakingService.clearActiveSession(session.playerB);
        }

        await this.saveSession(session);

        // Emit Kafka event for UniClass integration
        const winnerId = playerAScore > playerBScore ? session.playerA : playerBScore > playerAScore ? session.playerB : undefined;
        await GameResultEventService.emitCardFlipResult(session, winnerId, !winnerId);

        return {
          session,
          isMatch: true,
          gameOver: true,
          winner: winnerId,
        };
      }

      await this.saveSession(session);

      // Reset turn timer vì người chơi giữ lượt sau khi match
      await this.startTurnTimer(sessionId, session.config.turnTimeout);

      return { session, isMatch: true, gameOver: false };
    } else {
      // Không match — giữ nguyên lượt, đợi client gọi resetFlipped để úp bài rồi mới đổi lượt
      // currentTurn sẽ được đổi trong resetFlipped() sau khi bài đã úp

      await this.saveSession(session);
      return { session, isMatch: false, gameOver: false };
    }
    });
  }

  /** Reset các thẻ đang flip về trạng thái úp, sau đó đổi lượt (distributed lock, idempotent) */
  static async resetFlipped(sessionId: string): Promise<CardFlipSession | null> {
    return withRedisLock(sessionLockKey(sessionId), async () => {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    // Idempotent guard: nếu không còn thẻ nào đang lật (đã được reset bởi request trước),
    // trả về session nguyên trạng, không toggle turn lần nữa.
    const hasFlippedCards = session.cards.some((c) => c.flipped && !c.matched);
    if (!hasFlippedCards && session.lastFlipped.length === 0) {
      return session;
    }

    session.cards.forEach((c) => {
      if (c.flipped && !c.matched) c.flipped = false;
    });

    // Reset consecutive pairs của player vừa miss (turn switch = đã miss)
    if (session.currentTurn === session.playerA) {
      session.consecutivePairsA = 0;
    } else {
      session.consecutivePairsB = 0;
    }

    // Đổi lượt sau khi bài đã úp — đảm bảo lượt mới chỉ bắt đầu khi bài đã úp
    session.currentTurn = session.currentTurn === session.playerA ? session.playerB : session.playerA;
    session.lastFlipped = [];

    await this.saveSession(session);

    // Reset turn timer cho lượt mới
    await this.startTurnTimer(sessionId, session.config.turnTimeout);

    return session;
    });
  }

  /**
   * Xử lý người chơi disconnect — schedule grace period 30s qua BullMQ
   * (instance nào cũng cancel được khi user reconnect).
   */
  static async handleDisconnect(
    sessionId: string,
    userId: string,
  ): Promise<CardFlipResult | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'playing') return null;

    // Schedule thay thế timer cũ nếu có (cùng jobId)
    await TimerQueueService.scheduleMindGameDisconnectGrace(
      'card_flip',
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
        : (currentSession.playerA === userId ? currentSession.playerB : currentSession.playerA);
      const loserId = userId;

      // Kết thúc trận — đối thủ thắng
      currentSession.status = 'finished';
      currentSession.endedAt = new Date();

      // Clear all timers
      await this.clearAllTimers(sessionId);

      if (!currentSession.isAI) {
        await ScoreService.addWinPoints(winnerId, currentSession.config.winPoints, 'mind_game', 'card_flip');
      }
      await ScoreService.recordLoss(loserId, 'mind_game', 'card_flip');

      // Clear active session tracking
      await MatchmakingService.clearActiveSession(loserId);
      if (!currentSession.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await this.saveSession(currentSession);

      // Emit Kafka event for forfeit
      await GameResultEventService.emitCardFlipResult(currentSession, winnerId, false);

      // Emit END event qua socket để người còn lại biết
      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
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
    await TimerQueueService.cancelMindGameDisconnectGrace('card_flip', sessionId);
  }

  // ---- Private ----

  private static generateCards(count: number, configItems?: ReadonlyArray<{ type: 'emoji' | 'image'; value: string }>): CardFlipCard[] {
    // Ưu tiên cardItems từ config; fallback về CARD_EMOJIS (type='emoji')
    const pool = configItems && configItems.length > 0
      ? configItems
      : CARD_EMOJIS.map((e) => ({ type: 'emoji' as const, value: e }));

    const selected = shuffle([...pool]).slice(0, count);
    const cards: CardFlipCard[] = [];

    selected.forEach((item, index) => {
      cards.push({ id: index * 2, pairId: index, value: item.value, type: item.type, flipped: false, matched: false });
      cards.push({ id: index * 2 + 1, pairId: index, value: item.value, type: item.type, flipped: false, matched: false });
    });

    return shuffle(cards);
  }
}
