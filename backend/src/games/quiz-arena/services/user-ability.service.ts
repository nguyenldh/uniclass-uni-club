// ============================================================
// Quiz Arena — User Ability Service
// Tính toán nhóm năng lực (easy/medium/hard) cho học sinh
// ============================================================

import { redis } from '../../../config/index';
import { UserMatchHistoryModel } from '../../../models/index';
import { QUIZ_ARENA_REDIS_KEYS } from '@uniclub/shared';
import type { QuizDifficulty, QuizArenaConfig } from '@uniclub/shared';

interface MatchRecord {
  correct: number;
  total: number;
}

export class UserAbilityService {
  /**
   * Lấy nhóm năng lực hiện tại của học sinh.
   * Tính dựa trên N trận gần nhất (config.recentMatchesForAbility).
   * Default 'medium' nếu chưa có dữ liệu.
   */
  static async getAbilityBucket(
    userId: string,
    config: Pick<QuizArenaConfig, 'recentMatchesForAbility' | 'easyPlayerThreshold' | 'hardPlayerThreshold'>,
  ): Promise<QuizDifficulty> {
    const cacheKey = `${QUIZ_ARENA_REDIS_KEYS.USER_ABILITY}:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached as QuizDifficulty;

    const bucket = await UserAbilityService.computeBucket(userId, config);

    // Cache 10 phút — sẽ được invalidate sau khi chơi xong
    await redis.set(cacheKey, bucket, 'EX', 600);
    return bucket;
  }

  /**
   * Ghi nhận kết quả trận đấu vào MongoDB (source of truth) + Redis cache.
   * Đồng thời xóa cache ability để tính lại lần sau.
   */
  static async recordMatchResult(
    userId: string,
    correctCount: number,
    totalQuestions: number,
    maxRecent: number,
  ): Promise<void> {
    // 1. Lưu vào MongoDB (source of truth)
    await UserMatchHistoryModel.create({
      userId,
      gameType: 'quiz_arena',
      correctCount,
      totalQuestions,
      playedAt: new Date(),
    });

    // 2. Cập nhật Redis cache (capped list để đọc nhanh)
    const histKey = `${QUIZ_ARENA_REDIS_KEYS.USER_RECENT_MATCHES}:${userId}`;
    const record: MatchRecord = { correct: correctCount, total: totalQuestions };

    const pipeline = redis.pipeline();
    pipeline.rpush(histKey, JSON.stringify(record));
    // Giữ tối đa maxRecent phần tử (dùng khi maxRecent > 0)
    if (maxRecent > 0) {
      pipeline.ltrim(histKey, -maxRecent, -1);
    }
    pipeline.expire(histKey, 60 * 60 * 24 * 90); // 90 ngày
    await pipeline.exec();

    // 3. Xóa cache ability để tính lại
    await redis.del(`${QUIZ_ARENA_REDIS_KEYS.USER_ABILITY}:${userId}`);
  }

  // ---- private ----

  private static async computeBucket(
    userId: string,
    config: Pick<QuizArenaConfig, 'recentMatchesForAbility' | 'easyPlayerThreshold' | 'hardPlayerThreshold'>,
  ): Promise<QuizDifficulty> {
    const histKey = `${QUIZ_ARENA_REDIS_KEYS.USER_RECENT_MATCHES}:${userId}`;
    const maxRecent = config.recentMatchesForAbility;

    // Thử đọc từ Redis cache trước
    let raw = maxRecent > 0
      ? await redis.lrange(histKey, -maxRecent, -1)
      : await redis.lrange(histKey, 0, -1);

    // Nếu Redis cache trống, rebuild từ MongoDB
    if (!raw || raw.length === 0) {
      raw = await UserAbilityService.rebuildCacheFromMongo(userId, maxRecent);
    }

    if (!raw || raw.length === 0) return 'medium'; // default khi chưa có dữ liệu

    let totalCorrect = 0;
    let totalAnswered = 0;

    for (const item of raw) {
      try {
        const rec: MatchRecord = JSON.parse(item);
        totalCorrect += rec.correct;
        totalAnswered += rec.total;
      } catch {
        // skip corrupt entry
      }
    }

    if (totalAnswered === 0) return 'medium';

    const rate = totalCorrect / totalAnswered;

    if (rate < config.easyPlayerThreshold) return 'easy';
    if (rate >= config.hardPlayerThreshold) return 'hard';
    return 'medium';
  }

  /**
   * Rebuild Redis cache từ MongoDB khi cache miss.
   * Trả về mảng JSON string để computeBucket xử lý tiếp.
   */
  private static async rebuildCacheFromMongo(
    userId: string,
    maxRecent: number,
  ): Promise<string[]> {
    const limit = maxRecent > 0 ? maxRecent : 100; // Fallback limit nếu maxRecent = 0
    const docs = await UserMatchHistoryModel.find({ userId, gameType: 'quiz_arena' })
      .sort({ playedAt: -1 })
      .limit(limit)
      .lean();

    if (docs.length === 0) return [];

    // Đảo ngược để có thứ tự cũ → mới (giống Redis list)
    const records = docs.reverse().map((doc) =>
      JSON.stringify({ correct: doc.correctCount, total: doc.totalQuestions }),
    );

    // Ghi lại vào Redis cache
    const histKey = `${QUIZ_ARENA_REDIS_KEYS.USER_RECENT_MATCHES}:${userId}`;
    const pipeline = redis.pipeline();
    pipeline.del(histKey); // Clear trước
    for (const rec of records) {
      pipeline.rpush(histKey, rec);
    }
    pipeline.expire(histKey, 60 * 60 * 24 * 90); // 90 ngày
    await pipeline.exec();

    return records;
  }
}
