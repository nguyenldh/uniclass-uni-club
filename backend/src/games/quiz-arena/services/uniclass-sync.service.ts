// ============================================================
// Quiz Arena — UniClass Sync Service (Stub)
// TODO: Implement real HTTP call to UniClass API with HMAC signature
// ============================================================

import { redis } from '../../../config/index';
import { QUIZ_ARENA_REDIS_KEYS } from '@uniclub/shared';

export interface UniClassSyncPayload {
  userId: string;
  sessionId: string;
  correctCount: number;
  uniPointsEarned: number;
  playedAt: string; // ISO 8601
}

export class UniClassSyncService {
  /**
   * Đưa payload vào retry queue (Redis list).
   * TODO: Implement actual HTTP call to UniClass API here.
   *   - Tạo chữ ký HMAC SHA256 từ payload + secret key
   *   - POST đến UniClass endpoint
   *   - Nếu thành công: không cần retry
   *   - Nếu thất bại: giữ trong queue để retry worker xử lý
   */
  static async enqueueSync(payload: UniClassSyncPayload): Promise<void> {
    console.log(
      `[UniClassSync] Enqueue for user=${payload.userId} session=${payload.sessionId} ` +
      `correct=${payload.correctCount} points=${payload.uniPointsEarned}`,
    );

    await redis.lpush(
      QUIZ_ARENA_REDIS_KEYS.UNICLASS_SYNC_RETRY,
      JSON.stringify({ ...payload, enqueuedAt: new Date().toISOString() }),
    );
  }

  /**
   * Drain retry queue — placeholder cho background worker.
   * TODO: Implement retry worker (BullMQ / cron / agenda).
   */
  static async drainQueue(): Promise<void> {
    // TODO: Pop items from UNICLASS_SYNC_RETRY, call UniClass HTTP API
    console.warn('[UniClassSync] drainQueue is not implemented yet.');
  }
}
