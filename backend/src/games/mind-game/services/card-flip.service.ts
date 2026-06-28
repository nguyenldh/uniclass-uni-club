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
  CardFlipMode,
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

  /** Bắt đầu game timer cho toàn bộ trận (chỉ dùng cho mode 'basic') */
  private static async startGameTimer(sessionId: string, maxDurationSec: number): Promise<void> {
    await TimerQueueService.scheduleMindGameGameTimeout('card_flip', sessionId, maxDurationSec * 1000);
  }

  /** Xóa game timer */
  private static async clearGameTimer(sessionId: string): Promise<void> {
    await TimerQueueService.cancelMindGameGameTimeout('card_flip', sessionId);
  }

  /** Bắt đầu/đặt lại flag-fall timer cho quỹ giờ một người chơi (chỉ dùng cho mode 'advanced') */
  private static async startPlayerClock(sessionId: string, userId: string, remainingMs: number): Promise<void> {
    await TimerQueueService.scheduleMindGamePlayerClockTimeout(
      'card_flip',
      sessionId,
      userId,
      Math.max(0, remainingMs),
    );
  }

  /** Xóa flag-fall timer của một người chơi */
  private static async clearPlayerClock(sessionId: string, userId: string): Promise<void> {
    await TimerQueueService.cancelMindGamePlayerClockTimeout('card_flip', sessionId, userId);
  }

  /** Xóa tất cả timer của session (cả 2 quỹ giờ người chơi cho mode 'advanced') */
  private static async clearAllTimers(sessionId: string, session?: CardFlipSession): Promise<void> {
    const tasks: Promise<void>[] = [
      this.clearTurnTimer(sessionId),
      this.clearGameTimer(sessionId),
      TimerQueueService.cancelMindGameDisconnectGrace('card_flip', sessionId),
    ];
    if (session) {
      tasks.push(this.clearPlayerClock(sessionId, session.playerA));
      tasks.push(this.clearPlayerClock(sessionId, session.playerB));
    }
    await Promise.all(tasks);
  }

  // ---- Advanced (chess-clock) helpers ----

  /**
   * Trừ thời gian đã trôi của người đang giữ lượt vào quỹ giờ của họ (mode 'advanced').
   * Gọi tại biên kết thúc một segment (lật xong 2 thẻ, hoặc đổi lượt).
   */
  private static commitElapsed(session: CardFlipSession, now: number): void {
    if (session.mode !== 'advanced' || session.turnStartedAt == null) return;
    const elapsed = Math.max(0, now - session.turnStartedAt);
    if (session.currentTurn === session.playerA) {
      session.timeRemainingA = Math.max(0, (session.timeRemainingA ?? 0) - elapsed);
    } else {
      session.timeRemainingB = Math.max(0, (session.timeRemainingB ?? 0) - elapsed);
    }
  }

  /** Quỹ giờ còn lại (ms) của một người chơi (mode 'advanced') */
  private static remainingFor(session: CardFlipSession, userId: string): number {
    return (userId === session.playerA ? session.timeRemainingA : session.timeRemainingB) ?? 0;
  }

  /**
   * Payload chuẩn cho event CARD_FLIP_STATE — gom field đồng hồ để mọi nơi
   * (socket/REST/timeout) broadcast nhất quán. `serverNow` để client hiệu chỉnh lệch giờ.
   */
  static statePayload(session: CardFlipSession, isMatch?: boolean) {
    return {
      cards: session.cards,
      currentTurn: session.currentTurn,
      scores: session.scores,
      lastFlipped: session.lastFlipped,
      isMatch,
      mode: session.mode,
      // Đồng hồ Cơ bản
      deadlineAt: session.deadlineAt,
      // Đồng hồ Nâng cao (cờ vua)
      timeRemainingA: session.timeRemainingA,
      timeRemainingB: session.timeRemainingB,
      turnStartedAt: session.turnStartedAt,
      serverNow: Date.now(),
    };
  }

  /**
   * Xử lý khi hết thời gian lượt (chỉ mode 'basic') → TỰ ĐỘNG CHUYỂN LƯỢT (auto-pass),
   * không xử thua. Chống treo khi người chơi AFK. Mode 'advanced' không dùng turn-timeout
   * (đã có player-clock flag-fall). Được gọi từ BullMQ worker.
   */
  static async handleTurnTimeout(sessionId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'playing') return;
      if (session.mode === 'advanced') return; // an toàn: advanced không auto-pass

      // Úp lại thẻ đang lật dở, reset chuỗi của người AFK, đổi lượt
      session.cards.forEach((c) => {
        if (c.flipped && !c.matched) c.flipped = false;
      });
      if (session.currentTurn === session.playerA) {
        session.consecutivePairsA = 0;
      } else {
        session.consecutivePairsB = 0;
      }
      session.currentTurn = session.currentTurn === session.playerA ? session.playerB : session.playerA;
      session.lastFlipped = [];

      await this.saveSession(session);
      await this.startTurnTimer(sessionId, session.config.turnTimeout);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE, this.statePayload(session, false));
    });
  }

  /**
   * Xử lý khi quỹ giờ cờ vua của một người chơi cạn (chỉ mode 'advanced') → người đó THUA NGAY,
   * đối thủ thắng. Được gọi từ BullMQ worker.
   */
  static async handlePlayerClockTimeout(sessionId: string, userId: string, io: Server): Promise<void> {
    await withRedisLock(sessionLockKey(sessionId), async () => {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'playing') return;
      if (session.mode !== 'advanced') return;
      // Job cũ (đã đổi lượt / đã cộng giờ) → bỏ qua nếu không còn là lượt của user này
      if (session.currentTurn !== userId) return;

      const loserId = userId;
      const winnerId = loserId === session.playerA ? session.playerB : session.playerA;

      session.status = 'finished';
      session.endedAt = new Date();
      // Đặt quỹ giờ người thua về 0 để client hiển thị đúng
      if (loserId === session.playerA) session.timeRemainingA = 0;
      else session.timeRemainingB = 0;

      if (winnerId !== 'AI') {
        await ScoreService.addWinPoints(winnerId, session.config.winPoints, 'mind_game', 'card_flip');
      }
      if (loserId !== 'AI') {
        await ScoreService.recordLoss(loserId, 'mind_game', 'card_flip');
      }

      await this.clearAllTimers(sessionId, session);

      if (loserId !== 'AI') await MatchmakingService.clearActiveSession(loserId);
      if (winnerId !== 'AI') await MatchmakingService.clearActiveSession(winnerId);

      await this.saveSession(session);

      await GameResultEventService.emitCardFlipResult(session, winnerId, false);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
        winner: winnerId,
        isDraw: false,
        reason: 'time_out',
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

      await this.clearAllTimers(sessionId, session);

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

  /**
   * Khởi tạo field đồng hồ theo mode + lên lịch timer ban đầu.
   * - basic:    đặt deadlineAt + game-timeout + turn-timeout (auto-pass).
   * - advanced: nạp quỹ giờ 2 người + đặt turnStartedAt + flag-fall cho người đi trước.
   */
  private static async initTimers(session: CardFlipSession): Promise<void> {
    const now = session.startedAt.getTime();
    if (session.mode === 'advanced') {
      const startMs = session.config.advancedStartTime * 1000;
      session.timeRemainingA = startMs;
      session.timeRemainingB = startMs;
      session.turnStartedAt = now;
      await this.saveSession(session);
      await this.startPlayerClock(session.sessionId, session.currentTurn, startMs);
    } else {
      session.deadlineAt = now + session.config.basicTotalTime * 1000;
      await this.saveSession(session);
      await this.startGameTimer(session.sessionId, session.config.basicTotalTime);
      await this.startTurnTimer(session.sessionId, session.config.turnTimeout);
    }
  }

  /** Tạo session PvP */
  static async createPVPSession(
    playerA: string,
    playerB: string,
    mode: CardFlipMode = 'basic',
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
      mode,
      startedAt: new Date(),
      lastFlipped: [],
      consecutivePairsA: 0,
      consecutivePairsB: 0,
      maxConsecutivePairsA: 0,
      maxConsecutivePairsB: 0,
    };

    await this.initTimers(session);

    return session;
  }

  /** Tạo session vs AI. Trả về session và botProfile để hiển thị nhất quán. */
  static async createAISession(
    userId: string,
    difficulty: AIDifficulty = 'medium',
    mode: CardFlipMode = 'basic',
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
      mode,
      startedAt: new Date(),
      lastFlipped: [],
      consecutivePairsA: 0,
      consecutivePairsB: 0,
      maxConsecutivePairsA: 0,
      maxConsecutivePairsB: 0,
    };

    await this.initTimers(session);

    return { session, botProfile: { name: botName, avatar: botAvatar } };
  }

  /** Lấy session */
  static async getSession(sessionId: string): Promise<CardFlipSession | null> {
    const data = await redis.get(`${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:${sessionId}`);
    if (!data) return null;
    const sessionData = JSON.parse(data);

    // Session cũ (trước khi có chế độ chơi) → coi như 'basic'
    if (!sessionData.mode) sessionData.mode = 'basic';

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
    const now = Date.now();

    if (isMatch) {
      // Match! Cộng điểm, giữ lượt
      firstCard.matched = true;
      secondCard.matched = true;

      if (userId === session.playerA) {
        session.scores.playerA += 100; // Cộng 100 điểm cho mỗi cặp đúng
        // Track consecutive pairs
        session.consecutivePairsA++;
        if (session.consecutivePairsA > session.maxConsecutivePairsA) {
          session.maxConsecutivePairsA = session.consecutivePairsA;
        }
      } else {
        session.scores.playerB += 100; // Cộng 100 điểm cho mỗi cặp đúng
        // Track consecutive pairs
        session.consecutivePairsB++;
        if (session.consecutivePairsB > session.maxConsecutivePairsB) {
          session.maxConsecutivePairsB = session.consecutivePairsB;
        }
      }

      session.lastFlipped = [];

      // Advanced (cờ vua): chốt giờ đã dùng của segment, cộng bonus, GIỮ lượt → segment mới.
      if (session.mode === 'advanced') {
        this.commitElapsed(session, now);
        await this.clearPlayerClock(sessionId, userId);
        const bonusMs = session.config.timeBonusOnMatch * 1000;
        if (userId === session.playerA) {
          session.timeRemainingA = (session.timeRemainingA ?? 0) + bonusMs;
        } else {
          session.timeRemainingB = (session.timeRemainingB ?? 0) + bonusMs;
        }
        session.turnStartedAt = now;
      }

      // Kiểm tra game over
      const allMatched = session.cards.every((c) => c.matched);
      if (allMatched) {
        session.status = 'finished';
        session.endedAt = new Date();

        // Clear all timers
        await this.clearAllTimers(sessionId, session);

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

      // Người chơi giữ lượt sau khi match → đặt lại timer cho segment mới.
      if (session.mode === 'advanced') {
        await this.startPlayerClock(sessionId, userId, this.remainingFor(session, userId));
      } else {
        await this.startTurnTimer(sessionId, session.config.turnTimeout);
      }

      return { session, isMatch: true, gameOver: false };
    } else {
      // Không match — giữ nguyên lượt, đợi client gọi resetFlipped để úp bài rồi mới đổi lượt.
      // currentTurn + chốt giờ (advanced) sẽ được xử lý trong resetFlipped() sau khi bài úp.
      // Advanced: CỐ Ý không đụng đồng hồ ở đây → flag-fall job của người đang đi vẫn chạy
      // xuyên animation úp bài, đảm bảo trận không treo nếu client không gọi resetFlipped.
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

    // Advanced: chốt giờ người vừa miss (đồng hồ chạy xuyên cả animation úp bài),
    // dừng flag-fall của họ TRƯỚC khi đổi lượt.
    if (session.mode === 'advanced') {
      this.commitElapsed(session, Date.now());
      await this.clearPlayerClock(sessionId, session.currentTurn);
    }

    // Đổi lượt sau khi bài đã úp — đảm bảo lượt mới chỉ bắt đầu khi bài đã úp
    session.currentTurn = session.currentTurn === session.playerA ? session.playerB : session.playerA;
    session.lastFlipped = [];

    // Đặt timer cho lượt mới theo mode
    if (session.mode === 'advanced') {
      session.turnStartedAt = Date.now();
      await this.saveSession(session);
      await this.startPlayerClock(sessionId, session.currentTurn, this.remainingFor(session, session.currentTurn));
    } else {
      await this.saveSession(session);
      await this.startTurnTimer(sessionId, session.config.turnTimeout);
    }

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
      await this.clearAllTimers(sessionId, currentSession);

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
