import { redis } from '../config/index';
import { UserScoreModel } from '../models/index';
import { REDIS_KEYS } from '@uniclub/shared';
import type { UserScore, GameType, GameScoreDetail } from '@uniclub/shared';

/** Scope của leaderboard: total, mind_game, gomoku, card_flip, quiz_arena, ... */
export type LeaderboardScope = 'total' | GameType | 'gomoku' | 'card_flip';

const EMPTY_DETAIL = (): GameScoreDetail => ({ points: 0, played: 0, won: 0 });

function leaderboardKey(scope: LeaderboardScope): string {
  return `${REDIS_KEYS.LEADERBOARD}:${scope}`;
}

export class ScoreService {
  // ============================================================
  // Get / Create
  // ============================================================

  /** Lấy điểm của user */
  static async getUserScore(userId: string): Promise<UserScore> {
    const cached = await redis.get(`${REDIS_KEYS.USER_SCORE}:${userId}`);
    if (cached) return JSON.parse(cached);

    let doc = await UserScoreModel.findOne({ userId });
    if (!doc) {
      doc = await UserScoreModel.create({
        userId,
        totalPoints: 0,
        gamesPlayed: 0,
        gamesWon: 0,
      });
    }

    const score = this.toUserScore(doc);
    await redis.set(`${REDIS_KEYS.USER_SCORE}:${userId}`, JSON.stringify(score), 'EX', 300);
    return score;
  }

  // ============================================================
  // Win / Loss — cập nhật cả MongoDB & Redis Sorted Set
  // ============================================================

  /** Cộng điểm khi thắng */
  static async addWinPoints(
    userId: string,
    points: number,
    gameType: GameType,
    subGameType?: 'gomoku' | 'card_flip',
  ): Promise<UserScore> {
    const $inc: Record<string, number> = {
      totalPoints: points,
      gamesPlayed: 1,
      gamesWon: 1,
      [`${gameType}.points`]: points,
      [`${gameType}.played`]: 1,
      [`${gameType}.won`]: 1,
    };
    if (subGameType) {
      $inc[`${subGameType}.points`] = points;
      $inc[`${subGameType}.played`] = 1;
      $inc[`${subGameType}.won`] = 1;
    }

    const doc = await UserScoreModel.findOneAndUpdate(
      { userId },
      { $inc, $set: { lastPlayedAt: new Date() } },
      { upsert: true, new: true },
    );

    const score = this.toUserScore(doc);
    await this.updateLeaderboardCache(userId, score);
    await redis.set(`${REDIS_KEYS.USER_SCORE}:${userId}`, JSON.stringify(score), 'EX', 300);
    return score;
  }

  /** Cộng điểm hàng loạt khi thắng (cho weekly event hoặc các batch grading) */
  static async addWinPointsBatch(
    updates: Array<{ userId: string; points: number; gameType: GameType; subGameType?: 'gomoku' | 'card_flip' }>
  ): Promise<void> {
    if (updates.length === 0) return;

    // 1. Chuẩn bị bulkWrite cho MongoDB
    const bulkOps = updates.map(({ userId, points, gameType, subGameType }) => {
      const $inc: Record<string, number> = {
        totalPoints: points,
        gamesPlayed: 1,
        gamesWon: 1,
        [`${gameType}.points`]: points,
        [`${gameType}.played`]: 1,
        [`${gameType}.won`]: 1,
      };
      if (subGameType) {
        $inc[`${subGameType}.points`] = points;
        $inc[`${subGameType}.played`] = 1;
        $inc[`${subGameType}.won`] = 1;
      }
      return {
        updateOne: {
          filter: { userId },
          update: { $inc, $set: { lastPlayedAt: new Date() } },
          upsert: true,
        }
      };
    });

    await UserScoreModel.bulkWrite(bulkOps);

    // 2. Lấy UserScores mới để cập nhật Redis cache
    const userIds = updates.map((u) => u.userId);
    const docs = await UserScoreModel.find({ userId: { $in: userIds } }).lean();
    const docMap = new Map(docs.map((d) => [d.userId, d]));

    // 3. Cập nhật Redis — từng lệnh riêng biệt để tránh CROSSSLOT trên Redis Cluster
    // (các key user:score:{userId}, leaderboard:total, leaderboard:{gameType} nằm ở các slot khác nhau)
    for (const update of updates) {
      const doc = docMap.get(update.userId);
      if (!doc) continue;

      const score = this.toUserScore(doc);
      await redis.set(`${REDIS_KEYS.USER_SCORE}:${update.userId}`, JSON.stringify(score), 'EX', 300);

      // Cập nhật total leaderboard
      await redis.zadd(leaderboardKey('total'), score.totalPoints, update.userId);

      // Cập nhật game leaderboard
      if (score[update.gameType].points > 0) {
        await redis.zadd(leaderboardKey(update.gameType), score[update.gameType].points, update.userId);
      }
    }
  }

  /**
   * Ghi nhận thua (tăng played, KHÔNG tăng won).
   * `points` > 0: vẫn cộng điểm/cúp (vd So Tài: người thua nhận cúp theo số câu
   * đúng) và cập nhật leaderboard — chỉ khác addWinPoints ở chỗ không tính là thắng.
   */
  static async recordLoss(
    userId: string,
    gameType: GameType,
    subGameType?: 'gomoku' | 'card_flip',
    points: number = 0,
  ): Promise<UserScore> {
    const $inc: Record<string, number> = {
      gamesPlayed: 1,
      [`${gameType}.played`]: 1,
    };
    if (points > 0) {
      $inc.totalPoints = points;
      $inc[`${gameType}.points`] = points;
    }
    if (subGameType) {
      $inc[`${subGameType}.played`] = 1;
      if (points > 0) $inc[`${subGameType}.points`] = points;
    }

    const doc = await UserScoreModel.findOneAndUpdate(
      { userId },
      { $inc, $set: { lastPlayedAt: new Date() } },
      { upsert: true, new: true },
    );

    const score = this.toUserScore(doc);
    // Cộng điểm → cập nhật lại bảng xếp hạng (giống addWinPoints)
    if (points > 0) await this.updateLeaderboardCache(userId, score);
    await redis.set(`${REDIS_KEYS.USER_SCORE}:${userId}`, JSON.stringify(score), 'EX', 300);
    return score;
  }

  // ============================================================
  // Leaderboard — Redis Sorted Set
  // ============================================================

  /**
   * Lấy bảng xếp hạng từ Redis Sorted Set.
   * @param scope  'total' | 'mind_game' | 'gomoku' | 'card_flip' | ...
   * @param limit  Số lượng top
   */
  static async getLeaderboard(scope: LeaderboardScope = 'total', limit: number = 20): Promise<UserScore[]> {
    const key = leaderboardKey(scope);

    // Kiểm tra Redis có dữ liệu chưa — nếu chưa thì sync từ MongoDB
    const exists = await redis.exists(key);
    if (!exists) {
      await this.syncLeaderboardFromDB(scope);
    }

    const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    if (results.length === 0) return [];

    // Lấy thông tin chi tiết từng user
    const userIds: string[] = [];
    for (let i = 0; i < results.length; i += 2) {
      userIds.push(results[i]);
    }

    const scores = await Promise.all(userIds.map((id) => this.getUserScore(id)));
    return scores;
  }

  /**
   * Đồng bộ leaderboard từ MongoDB → Redis (dùng khi cache miss hoặc admin force sync).
   */
  static async syncLeaderboardFromDB(scope: LeaderboardScope = 'total'): Promise<void> {
    const key = leaderboardKey(scope);
    
    let sortField = 'totalPoints';
    if (scope === 'gomoku' || scope === 'card_flip') {
      sortField = `${scope}.points`;
    } else if (scope !== 'total') {
      sortField = `${scope}.points`;
    }

    const docs = await UserScoreModel.find()
      .sort({ [sortField]: -1 })
      .limit(1000)
      .lean();

    if (docs.length === 0) return;

    const multi = redis.multi();
    multi.del(key);

    for (const doc of docs) {
      const scoreValue = this.getScopeValue(doc, scope);
      multi.zadd(key, scoreValue, doc.userId);
    }

    // Set TTL 1 giờ — sẽ được refresh khi có update
    multi.expire(key, 3600);
    await multi.exec();
  }

  // ============================================================
  // Helpers
  // ============================================================

  private static toUserScore(doc: any): UserScore {
    return {
      userId: doc.userId,
      totalPoints: doc.totalPoints ?? 0,
      gamesPlayed: doc.gamesPlayed ?? 0,
      gamesWon: doc.gamesWon ?? 0,
      mind_game: doc.mind_game ?? EMPTY_DETAIL(),
      quiz_arena: doc.quiz_arena ?? EMPTY_DETAIL(),
      boss_battle: doc.boss_battle ?? EMPTY_DETAIL(),
      weekly_event: doc.weekly_event ?? EMPTY_DETAIL(),
      gomoku: doc.gomoku ?? EMPTY_DETAIL(),
      card_flip: doc.card_flip ?? EMPTY_DETAIL(),
      lastPlayedAt: doc.lastPlayedAt,
    };
  }

  /** Lấy điểm theo scope từ document */
  private static getScopeValue(doc: any, scope: LeaderboardScope): number {
    switch (scope) {
      case 'total':
        return doc.totalPoints ?? 0;
      case 'gomoku':
        return doc.gomoku?.points ?? 0;
      case 'card_flip':
        return doc.card_flip?.points ?? 0;
      default:
        // mind_game, quiz_arena, boss_battle, weekly_event
        return doc[scope]?.points ?? 0;
    }
  }

  /** Cập nhật tất cả leaderboard sorted sets liên quan sau mỗi lần thắng */
  private static async updateLeaderboardCache(userId: string, score: UserScore): Promise<void> {
    // KHÔNG dùng multi/exec trên Redis Cluster vì các key khác slot → CROSSSLOT
    // Thực hiện từng lệnh riêng biệt

    // Luôn cập nhật total
    await redis.zadd(leaderboardKey('total'), score.totalPoints, userId);

    // Cập nhật theo gameType nếu có điểm > 0
    const gameTypes: GameType[] = ['mind_game', 'quiz_arena', 'boss_battle', 'weekly_event'];
    for (const gt of gameTypes) {
      if (score[gt].points > 0) {
        await redis.zadd(leaderboardKey(gt), score[gt].points, userId);
      }
    }

    // Cập nhật sub-game
    if (score.gomoku.points > 0) {
      await redis.zadd(leaderboardKey('gomoku'), score.gomoku.points, userId);
    }
    if (score.card_flip.points > 0) {
      await redis.zadd(leaderboardKey('card_flip'), score.card_flip.points, userId);
    }
  }
}
