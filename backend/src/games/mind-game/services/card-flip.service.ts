// ============================================================
// Mind Game — Card Flip Service (Lật thẻ PvP)
// ============================================================

import { redis } from '../../../config/index';
import { GameConfigService } from '../../../services/game-config.service';
import { ScoreService } from '../../../services/score.service';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { BotProfileService } from '../../../services/bot-profile.service';
import { GameResultEventService } from '../../../services/game-result-event.service';
import { generateSessionId, shuffle } from '../../../utils/index';
import { MIND_GAME_REDIS_KEYS, CARD_EMOJIS } from '@uniclub/shared';
import type {
  CardFlipSession,
  CardFlipCard,
  CardFlipResult,
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

/**
 * Mutex per-session để serialize các thao tác flip, chống race condition
 * khi nhiều request đến cùng lúc (click nhanh, network lag...).
 */
const sessionLocks = new Map<string, Promise<void>>();

/** Acquire lock cho 1 session, đảm bảo các thao tác tuần tự */
async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  sessionLocks.set(sessionId, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    // Cleanup lock nếu không còn ai chờ
    if (sessionLocks.get(sessionId) === next) {
      sessionLocks.delete(sessionId);
    }
  }
}

/** Set server IO instance */
export function setCardFlipServerIO(io: import('socket.io').Server): void {
  serverIO = io;
}

export class CardFlipService {
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

  /** Xử lý lật thẻ (có mutex per-session chống race condition) */
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
    return withSessionLock(sessionId, async () => {
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
          const winnerId = session.isAI ? 'AI' : session.playerB;
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
      return { session, isMatch: true, gameOver: false };
    } else {
      // Không match — giữ nguyên lượt, đợi client gọi resetFlipped để úp bài rồi mới đổi lượt
      // currentTurn sẽ được đổi trong resetFlipped() sau khi bài đã úp

      await this.saveSession(session);
      return { session, isMatch: false, gameOver: false };
    }
    });
  }

  /** Reset các thẻ đang flip về trạng thái úp, sau đó đổi lượt (có mutex, idempotent) */
  static async resetFlipped(sessionId: string): Promise<CardFlipSession | null> {
    return withSessionLock(sessionId, async () => {
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
    return session;
    });
  }

  /** Xử lý người chơi disconnect */
  static async handleDisconnect(
    sessionId: string,
    userId: string,
  ): Promise<CardFlipResult | null> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'playing') return null;

    // Cả AI và PvP đều có grace period 30s
    const existingTimer = disconnectTimers.get(sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    const winnerId = session.isAI ? 'AI' : (session.playerA === userId ? session.playerB : session.playerA);
    const loserId = userId;

    const timer = setTimeout(async () => {
      disconnectTimers.delete(sessionId);
      // Kiểm tra lại session
      const currentSession = await CardFlipService.getSession(sessionId);
      if (!currentSession || currentSession.status !== 'playing') return;

      // Kết thúc trận — đối thủ thắng
      currentSession.status = 'finished';
      currentSession.endedAt = new Date();

      if (!currentSession.isAI) {
        await ScoreService.addWinPoints(winnerId, currentSession.config.winPoints, 'mind_game', 'card_flip');
      }
      await ScoreService.recordLoss(loserId, 'mind_game', 'card_flip');

      // Clear active session tracking
      await MatchmakingService.clearActiveSession(loserId);
      if (!currentSession.isAI) {
        await MatchmakingService.clearActiveSession(winnerId);
      }

      await CardFlipService.saveSession(currentSession);

      // Emit Kafka event for forfeit
      await GameResultEventService.emitCardFlipResult(currentSession, winnerId, false);

      // Emit END event qua socket để người còn lại biết
      if (serverIO) {
        const { MIND_GAME_SOCKET_EVENTS } = await import('@uniclub/shared');
        serverIO.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
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
