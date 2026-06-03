// ============================================================
// Matchmaking Service — game-agnostic, tái sử dụng cho mọi game PvP
// ============================================================

import { redis } from '../config/index';
import { MATCHMAKING_REDIS_KEYS, DEFAULT_MATCHMAKING_CONFIG, REDIS_KEYS } from '@uniclub/shared';
import type {
  MatchmakingEntry,
  MatchmakingResult,
  MatchmakingGameType,
  MatchmakingSessionFactory,
  AIDifficulty,
} from '@uniclub/shared';
import { UserService } from './user.service';

export class MatchmakingService {
  /** Registry: mỗi game PvP tự đăng ký factory khi khởi tạo */
  private static factories = new Map<MatchmakingGameType, MatchmakingSessionFactory>();

  /** Đăng ký session factory cho một game type */
  static registerFactory(gameType: MatchmakingGameType, factory: MatchmakingSessionFactory): void {
    this.factories.set(gameType, factory);
  }

  /** Lấy factory của game type */
  private static getFactory(gameType: MatchmakingGameType): MatchmakingSessionFactory {
    const factory = this.factories.get(gameType);
    if (!factory) {
      throw new Error(`No MatchmakingSessionFactory registered for game type: ${gameType}`);
    }
    return factory;
  }

  /** Build Redis queue key cho game type (hỗ trợ partitionKey) */
  private static queueKey(gameType: MatchmakingGameType, partitionKey?: string): string {
    const base = `${MATCHMAKING_REDIS_KEYS.QUEUE}:${gameType}`;
    return partitionKey ? `${base}:${partitionKey}` : base;
  }

  /** Tham gia queue matchmaking */
  static async joinQueue(entry: MatchmakingEntry): Promise<MatchmakingResult> {
    const { gameType, userId, partitionKey } = entry;
    const key = this.queueKey(gameType, partitionKey);
    const queueData = await redis.lrange(key, 0, -1);

    for (const data of queueData) {
      const waiting: MatchmakingEntry = JSON.parse(data);

      // Không ghép với chính mình
      if (waiting.userId === userId) continue;

      // Xóa opponent khỏi queue
      await redis.lrem(key, 0, data);

      // Dùng factory của game để tạo session PvP
      const factory = this.getFactory(gameType);
      const session = await factory.createPVPSession(waiting.userId, userId);
      const opponent = await UserService.getUser(waiting.userId);

      return {
        status: 'matched',
        gameType,
        opponentId: waiting.userId,
        sessionId: session.sessionId,
        isAI: false,
        opponentProfile: {
          name: opponent?.name ?? '',
          avatar: opponent?.avatar,
        },
      };
    }

    // Không có opponent — vào queue
    await redis.rpush(key, JSON.stringify(entry));
    await redis.expire(key, DEFAULT_MATCHMAKING_CONFIG.timeout + 10);

    return { status: 'searching', gameType };
  }

  /** Rời queue */
  static async leaveQueue(userId: string, gameType: MatchmakingGameType, partitionKey?: string): Promise<void> {
    const key = this.queueKey(gameType, partitionKey);
    const queueData = await redis.lrange(key, 0, -1);

    for (const data of queueData) {
      const entry: MatchmakingEntry = JSON.parse(data);
      if (entry.userId === userId) {
        await redis.lrem(key, 0, data);
        break;
      }
    }
  }

  /** Xử lý timeout — chuyển sang đấu AI */
  static async handleTimeout(
    userId: string,
    gameType: MatchmakingGameType,
    aiDifficulty: AIDifficulty = 'medium',
    partitionKey?: string,
  ): Promise<MatchmakingResult | null> {
    // Kiểm tra xem user còn trong queue không — nếu đã được ghép thì bỏ qua
    const key = this.queueKey(gameType, partitionKey);
    const queueData = await redis.lrange(key, 0, -1);
    const stillInQueue = queueData.some((data) => {
      const entry: MatchmakingEntry = JSON.parse(data);
      return entry.userId === userId;
    });

    if (!stillInQueue) {
      // User đã được ghép hoặc đã rời queue — không tạo AI session
      return null;
    }

    await this.leaveQueue(userId, gameType, partitionKey);

    const factory = this.getFactory(gameType);
    const { sessionId, botProfile } = await factory.createAISession(userId, aiDifficulty);

    return {
      status: 'timeout',
      gameType,
      sessionId,
      isAI: true,
      aiDifficulty,
      opponentProfile: botProfile,
    };
  }

  /** Lấy kích thước queue */
  static async getQueueSize(gameType: MatchmakingGameType, partitionKey?: string): Promise<number> {
    return redis.llen(this.queueKey(gameType, partitionKey));
  }

  // ============================================================
  // Active Session Tracking — chặn user join queue khi đang trong session
  // ============================================================

  /**
   * Đánh dấu user đang trong một session active.
   * Gọi ngay sau khi tạo session (PvP hoặc AI).
   */
  static async setActiveSession(userId: string, sessionId: string, gameType: MatchmakingGameType): Promise<void> {
    await redis.set(
      `${REDIS_KEYS.USER_ACTIVE_SESSION}:${userId}`,
      `${sessionId}:${gameType}`,
      'EX',
      1800, // 30 phút TTL — đủ dài cho mọi game
    );
  }

  /**
   * Kiểm tra user có đang trong session active không.
   * Trả về `{ sessionId, gameType }` nếu có, `null` nếu không.
   */
  static async getActiveSession(userId: string): Promise<{ sessionId: string; gameType: string } | null> {
    const raw = await redis.get(`${REDIS_KEYS.USER_ACTIVE_SESSION}:${userId}`);
    
    if (!raw) return null;
    const [sessionId, gameType] = raw.split(':');
    return { sessionId, gameType };
  }

  /**
   * Xóa đánh dấu active session khi session kết thúc hoặc disconnect.
   */
  static async clearActiveSession(userId: string): Promise<void> {
    await redis.del(`${REDIS_KEYS.USER_ACTIVE_SESSION}:${userId}`);
  }
}
