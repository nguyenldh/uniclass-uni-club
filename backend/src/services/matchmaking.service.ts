// ============================================================
// Matchmaking Service — game-agnostic, tái sử dụng cho mọi game PvP
// ============================================================

import { redis } from '../config/index';
import { withRedisLock } from '../utils/redis-lock';
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

  /** Key của distributed lock bảo vệ một queue */
  private static queueLockKey(queueKey: string): string {
    return `lock:${queueKey}`;
  }

  /**
   * Tham gia queue matchmaking.
   *
   * Toàn bộ thao tác scan/remove/push queue chạy dưới distributed lock
   * theo queue key — chống race khi nhiều instance cùng đọc queue:
   * - 2 user cùng match 1 opponent
   * - 2 user cùng thấy queue rỗng rồi cùng push (đáng lẽ phải match nhau)
   * Entry cũ của chính user (tab cũ / reload) được dọn ngay tại đây.
   */
  static async joinQueue(entry: MatchmakingEntry): Promise<MatchmakingResult> {
    const { gameType, partitionKey } = entry;
    const userId = String(entry.userId); // Đảm bảo userId là string (REST body có thể gửi number)

    const key = this.queueKey(gameType, partitionKey);

    // Phần critical: quyết định "match ai / vào queue" phải atomic xuyên instance
    const matchedOpponent = await withRedisLock(this.queueLockKey(key), async () => {
      const queueData = await redis.lrange(key, 0, -1);

      for (const data of queueData) {
        const waiting: MatchmakingEntry = JSON.parse(data);

        // Entry cũ của chính user (reload / tab trước) — dọn để không bao giờ
        // bị người khác match vào entry stale, và không ghép với chính mình
        if (String(waiting.userId) === userId) {
          await redis.lrem(key, 0, data);
          continue;
        }

        // Xóa opponent khỏi queue; kiểm tra kết quả để chắc chắn mình "thắng" entry này
        const removed = await redis.lrem(key, 0, data);
        if (removed === 0) continue; // instance khác đã lấy mất — thử entry kế tiếp

        return waiting;
      }

      // Không có opponent — vào queue (entry đã normalize userId)
      await redis.rpush(key, JSON.stringify({ ...entry, userId }));
      await redis.expire(key, DEFAULT_MATCHMAKING_CONFIG.timeout + 10);
      return null;
    });

    if (matchedOpponent) {
      const opponentId = String(matchedOpponent.userId);
      console.log('Matching entry:', { ...entry, userId }, 'with waiting entry:', matchedOpponent);

      // Dùng factory của game để tạo session PvP
      const factory = this.getFactory(gameType);
      const session = await factory.createPVPSession(opponentId, userId);
      const opponent = await UserService.getUser(opponentId);

      console.log('Opponent', opponent);

      return {
        status: 'matched',
        gameType,
        opponentId,
        sessionId: session.sessionId,
        isAI: false,
        opponentProfile: {
          name: opponent?.name ?? '',
          avatar: opponent?.avatar,
        },
      };
    }

    return { status: 'searching', gameType };
  }

  /**
   * Rời queue. Trả về `true` nếu thực sự xóa được entry.
   *
   * `socketId` (tùy chọn): chỉ xóa entry thuộc đúng socket đó — dùng cho
   * disconnect cleanup, tránh socket cũ (reload) xóa nhầm entry của phiên
   * search mới cùng userId.
   */
  static async leaveQueue(
    userId: string,
    gameType: MatchmakingGameType,
    partitionKey?: string,
    socketId?: string,
  ): Promise<boolean> {
    const key = this.queueKey(gameType, partitionKey);
    const normalizedUserId = String(userId);

    return withRedisLock(this.queueLockKey(key), async () => {
      const queueData = await redis.lrange(key, 0, -1);

      for (const data of queueData) {
        const entry: MatchmakingEntry = JSON.parse(data);
        if (String(entry.userId) !== normalizedUserId) continue;
        if (socketId && entry.socketId !== socketId) continue;

        await redis.lrem(key, 0, data);
        return true;
      }
      return false;
    });
  }

  /** Xử lý timeout — chuyển sang đấu AI */
  static async handleTimeout(
    userId: string,
    gameType: MatchmakingGameType,
    aiDifficulty: AIDifficulty = 'medium',
    partitionKey?: string,
  ): Promise<MatchmakingResult | null> {
    // Check-và-remove atomic (dưới lock trong leaveQueue): nếu không còn entry
    // tức user đã được ghép hoặc đã rời queue — không tạo AI session.
    // Đóng race window cũ giữa "stillInQueue check" và "leaveQueue".
    const removed = await this.leaveQueue(userId, gameType, partitionKey);
    if (!removed) return null;

    const factory = this.getFactory(gameType);
    const { sessionId, botProfile } = await factory.createAISession(String(userId), aiDifficulty);

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
