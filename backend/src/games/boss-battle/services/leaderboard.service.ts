// ============================================================
// Boss Battle — Leaderboard Service (DM-08)
// ============================================================

import { redis } from '../../../config/index';
import { StudentBossProgressModel, UserModel } from '../../../models/index';
import {
  BOSS_BATTLE_REDIS_KEYS,
  BOSS_BATTLE_LEADERBOARD_CACHE_TTL,
  BOSS_BATTLE_SOCKET_EVENTS,
  BOSS_BATTLE_ROOM_PREFIX,
} from '@uniclub/shared';
import type { BossLeaderboardEntry, BossLeaderboardResponse } from '@uniclub/shared';
import { GameConfigService } from '../../../services/game-config.service';
import { getIO } from '../../../sockets/index';

const DEFAULT_LIMIT = 50;

function cacheKey(weekKey: string, gradeLevel: number): string {
  return `${BOSS_BATTLE_REDIS_KEYS.LEADERBOARD}:${weekKey}:${gradeLevel}`;
}

export class LeaderboardService {
  static async getLeaderboard(
    weekKey: string,
    gradeLevel: number,
    studentId?: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<BossLeaderboardResponse> {
    const cached = await redis.get(cacheKey(weekKey, gradeLevel));

    let entries: BossLeaderboardEntry[];
    let questionsPerWeek: number;

    if (cached) {
      const parsed = JSON.parse(cached) as { entries: BossLeaderboardEntry[]; questionsPerWeek: number };
      entries = parsed.entries.slice(0, limit);
      questionsPerWeek = parsed.questionsPerWeek;
    } else {
      const res = await this.recompute(weekKey, gradeLevel);
      entries = res.entries.slice(0, limit);
      questionsPerWeek = res.questionsPerWeek;
    }

    // myEntry: nếu studentId không nằm trong top, query riêng + tính rank
    let myEntry: BossLeaderboardEntry | null = null;
    if (studentId) {
      const inTop = entries.find((e) => e.studentId === studentId);
      if (inTop) {
        myEntry = inTop;
      } else {
        myEntry = await this.computeStudentEntry(weekKey, gradeLevel, studentId);
      }
    }

    return {
      weekKey,
      gradeLevel,
      questionsPerWeek,
      entries,
      myEntry,
    };
  }

  /** Tính lại toàn bộ top entries + ghi cache */
  static async recompute(
    weekKey: string,
    gradeLevel: number,
  ): Promise<{ entries: BossLeaderboardEntry[]; questionsPerWeek: number }> {
    const config = await GameConfigService.getBossBattleConfig();

    const progress = await StudentBossProgressModel.find({
      weekKey,
      gradeLevel,
      correctCountWeek: { $gt: 0 },
    })
      .sort({ correctCountWeek: -1, totalCorrectTimeSec: 1, lastAchievedAt: 1 })
      .limit(200)
      .lean();

    const studentIds = progress.map((p: any) => p.studentId);
    const users = await UserModel.find({ userId: { $in: studentIds } }).lean();
    const userMap = new Map<string, any>(users.map((u: any) => [u.userId, u]));

    const entries: BossLeaderboardEntry[] = progress.map((p: any, idx: number) => {
      const u = userMap.get(p.studentId);
      return {
        rank: idx + 1,
        studentId: p.studentId,
        displayName: u?.name ?? p.studentId,
        avatar: u?.avatar,
        correctCountWeek: p.correctCountWeek,
        totalCorrectTimeSec: p.totalCorrectTimeSec,
        lastAchievedAt: p.lastAchievedAt,
        pointsContributedWeek: p.pointsContributedWeek,
      };
    });

    const payload = { entries, questionsPerWeek: config.questionsPerWeek };
    await redis.set(
      cacheKey(weekKey, gradeLevel),
      JSON.stringify(payload),
      'EX',
      BOSS_BATTLE_LEADERBOARD_CACHE_TTL,
    );
    return payload;
  }

  /** Tính rank cho 1 HS không có trong top: dùng count progress xếp trước */
  static async computeStudentEntry(
    weekKey: string,
    gradeLevel: number,
    studentId: string,
  ): Promise<BossLeaderboardEntry | null> {
    const me = await StudentBossProgressModel.findOne({ weekKey, gradeLevel, studentId }).lean();
    if (!me || me.correctCountWeek === 0) return null;

    // Đếm số HS đứng trên: correct nhiều hơn, hoặc bằng nhưng time nhanh hơn, hoặc bằng cả 2 nhưng achieve sớm hơn
    const aboveCount = await StudentBossProgressModel.countDocuments({
      weekKey,
      gradeLevel,
      correctCountWeek: { $gt: 0 },
      $or: [
        { correctCountWeek: { $gt: me.correctCountWeek } },
        { correctCountWeek: me.correctCountWeek, totalCorrectTimeSec: { $lt: me.totalCorrectTimeSec } },
        {
          correctCountWeek: me.correctCountWeek,
          totalCorrectTimeSec: me.totalCorrectTimeSec,
          lastAchievedAt: { $lt: me.lastAchievedAt },
        },
      ],
    });

    const user = await UserModel.findOne({ userId: studentId }).lean();

    return {
      rank: aboveCount + 1,
      studentId,
      displayName: (user as any)?.name ?? studentId,
      avatar: (user as any)?.avatar,
      correctCountWeek: me.correctCountWeek,
      totalCorrectTimeSec: me.totalCorrectTimeSec,
      lastAchievedAt: me.lastAchievedAt,
      pointsContributedWeek: me.pointsContributedWeek,
    };
  }

  /** Invalidate + broadcast BXH realtime */
  static async invalidateAndBroadcast(weekKey: string, gradeLevel: number): Promise<void> {
    await redis.del(cacheKey(weekKey, gradeLevel));
    try {
      const fresh = await this.recompute(weekKey, gradeLevel);
      const io = getIO();
      const room = `${BOSS_BATTLE_ROOM_PREFIX}:${weekKey}:${gradeLevel}`;
      io.to(room).emit(BOSS_BATTLE_SOCKET_EVENTS.LEADERBOARD_UPDATE, {
        weekKey,
        gradeLevel,
        questionsPerWeek: fresh.questionsPerWeek,
        entries: fresh.entries.slice(0, DEFAULT_LIMIT),
        myEntry: null,
      });
    } catch (err) {
      // getIO chưa init (vd unit test) → bỏ qua
      console.warn('[BossBattle] broadcast leaderboard skipped:', err);
    }
  }
}
