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

/**
 * Thứ tự xếp hạng (4 tiêu chí):
 *   (1) pointsContributedWeek desc  (2) correctCountWeek desc
 *   (3) totalCorrectTimeSec asc (đến ms)  (4) lastAchievedAt asc
 * Đồng hạng CHỈ khi cả 4 tiêu chí trùng nhau.
 */
export const RANK_SORT = {
  pointsContributedWeek: -1,
  correctCountWeek: -1,
  totalCorrectTimeSec: 1,
  lastAchievedAt: 1,
} as const;

/** Thời gian quy về mili giây (số nguyên) để so trùng tiêu chí #3 ổn định với số thực. */
function timeMs(sec: number | null | undefined): number {
  return Math.round((sec ?? 0) * 1000);
}

/** Mốc thời điểm ghi nhận quy về epoch ms để so trùng tiêu chí #4. */
function stampMs(d: Date | null | undefined): number {
  return d ? new Date(d).getTime() : 0;
}

/** true khi hai bản ghi trùng CẢ 4 tiêu chí xếp hạng → đồng hạng. */
function isSameRank(a: any, b: any): boolean {
  return (
    (a.pointsContributedWeek ?? 0) === (b.pointsContributedWeek ?? 0) &&
    (a.correctCountWeek ?? 0) === (b.correctCountWeek ?? 0) &&
    timeMs(a.totalCorrectTimeSec) === timeMs(b.totalCorrectTimeSec) &&
    stampMs(a.lastAchievedAt) === stampMs(b.lastAchievedAt)
  );
}

/**
 * Gán rank kiểu "standard competition ranking" (1,2,2,4) cho danh sách progress
 * đã sắp theo RANK_SORT. Trả về mảng { rank, isTied } cùng index.
 */
export function assignRanks(sorted: any[]): Array<{ rank: number; isTied: boolean }> {
  const out: Array<{ rank: number; isTied: boolean }> = [];
  for (let i = 0; i < sorted.length; i++) {
    // Đồng hạng với người liền trước → giữ nguyên rank; nếu không → rank = vị trí + 1
    const rank = i > 0 && isSameRank(sorted[i - 1], sorted[i]) ? out[i - 1].rank : i + 1;
    out.push({ rank, isTied: false });
  }
  // Đánh dấu isTied cho mọi nhóm có từ 2 người cùng rank trở lên
  for (let i = 0; i < out.length; i++) {
    const tiedPrev = i > 0 && out[i - 1].rank === out[i].rank;
    const tiedNext = i < out.length - 1 && out[i + 1].rank === out[i].rank;
    out[i].isTied = tiedPrev || tiedNext;
  }
  return out;
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
      .sort(RANK_SORT)
      .limit(200)
      .lean();

    const ranks = assignRanks(progress);

    const studentIds = progress.map((p: any) => p.studentId);
    const users = await UserModel.find({ userId: { $in: studentIds } }).lean();
    const userMap = new Map<string, any>(users.map((u: any) => [u.userId, u]));

    const entries: BossLeaderboardEntry[] = progress.map((p: any, idx: number) => {
      const u = userMap.get(p.studentId);
      return {
        rank: ranks[idx].rank,
        studentId: p.studentId,
        displayName: u?.name ?? p.studentId,
        avatar: u?.avatar,
        correctCountWeek: p.correctCountWeek,
        totalCorrectTimeSec: p.totalCorrectTimeSec,
        lastAchievedAt: p.lastAchievedAt,
        pointsContributedWeek: p.pointsContributedWeek,
        isTied: ranks[idx].isTied,
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

    // Đếm số HS xếp TRÊN theo đúng thứ tự 4 tiêu chí (standard competition ranking):
    //   điểm cao hơn; hoặc bằng điểm & câu đúng nhiều hơn;
    //   hoặc bằng điểm+câu & thời gian nhanh hơn; hoặc bằng cả 3 & ghi nhận sớm hơn
    const aboveCount = await StudentBossProgressModel.countDocuments({
      weekKey,
      gradeLevel,
      correctCountWeek: { $gt: 0 },
      $or: [
        { pointsContributedWeek: { $gt: me.pointsContributedWeek } },
        {
          pointsContributedWeek: me.pointsContributedWeek,
          correctCountWeek: { $gt: me.correctCountWeek },
        },
        {
          pointsContributedWeek: me.pointsContributedWeek,
          correctCountWeek: me.correctCountWeek,
          totalCorrectTimeSec: { $lt: me.totalCorrectTimeSec },
        },
        {
          pointsContributedWeek: me.pointsContributedWeek,
          correctCountWeek: me.correctCountWeek,
          totalCorrectTimeSec: me.totalCorrectTimeSec,
          lastAchievedAt: { $lt: me.lastAchievedAt },
        },
      ],
    });

    // Đồng hạng: tồn tại HS khác trùng CẢ 4 tiêu chí
    const tiedCount = await StudentBossProgressModel.countDocuments({
      weekKey,
      gradeLevel,
      studentId: { $ne: studentId },
      pointsContributedWeek: me.pointsContributedWeek,
      correctCountWeek: me.correctCountWeek,
      totalCorrectTimeSec: me.totalCorrectTimeSec,
      lastAchievedAt: me.lastAchievedAt,
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
      isTied: tiedCount > 0,
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
