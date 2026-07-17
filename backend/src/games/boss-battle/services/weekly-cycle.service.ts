// ============================================================
// Boss Battle — Weekly Cycle Service (FLW-01/FLW-02/FLW-08)
// initWeek / closeWeek / expireHonors — idempotent với Redis lock
// ============================================================

import mongoose from 'mongoose';
import { redis } from '../../../config/index';
import {
  BossInstanceModel,
  StudentBossProgressModel,
  WeeklyHonorModel,
  UserModel,
} from '../../../models/index';
import {
  BOSS_BATTLE_REDIS_KEYS,
  BOSS_BATTLE_CYCLE_LOCK_TTL,
  BOSS_BATTLE_HONOR_TOP_N,
  BOSS_BATTLE_FRAME_VALID_DAYS,
  DEFAULT_BOSS_BATTLE_CONFIG,
} from '@uniclub/shared';
import type { BossBattleConfig, WeeklyHonor } from '@uniclub/shared';
import { GameConfigService } from '../../../services/game-config.service';
import { RANK_SORT, assignRanks } from './leaderboard.service';
import { QuestionSetService } from './question-set.service';
import { BossQuestionService } from './boss-question.service';
import { BossWeeklyConfigService } from './boss-weekly-config.service';
import { getPreviousWeekKey } from '../utils/week';

const DEFAULT_GRADES = [3, 4, 5, 6, 7, 8, 9];

async function acquireLock(key: string, ttlSec: number): Promise<boolean> {
  const ok = await redis.set(key, '1', 'EX', ttlSec, 'NX');
  return ok === 'OK';
}

async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}

function pickInitialBossImage(config: BossBattleConfig): string {
  const sorted = [...config.bossStates].sort((a, b) => b.minPercent - a.minPercent);
  return sorted[0]?.img ?? '';
}

export interface InitWeekResult {
  weekKey: string;
  initializedGrades: number[];
  skippedGrades: number[];
  closedPreviousWeek: boolean;
  previousWeekKey?: string;
}

export interface CloseWeekResult {
  weekKey: string;
  honorsCreated: { gradeLevel: number; count: number }[];
}

export class WeeklyCycleService {
  /**
   * FLW-01: Khởi tạo BossInstance + 7 QuestionSet cho mỗi grade của tuần.
   * Đóng tuần trước nếu chưa đóng.
   */
  static async initWeek(weekKey: string, grades: number[] = DEFAULT_GRADES): Promise<InitWeekResult> {
    const lockKey = `${BOSS_BATTLE_REDIS_KEYS.INIT_WEEK_LOCK}:${weekKey}`;
    const locked = await acquireLock(lockKey, BOSS_BATTLE_CYCLE_LOCK_TTL);
    if (!locked) {
      throw new Error(`Init week already in progress: ${weekKey}`);
    }

    try {
      // Validate: mỗi khối CHƯA khởi tạo phải có đủ số câu hỏi (questionsPerWeek) trong kho.
      // Nếu thiếu → chặn toàn bộ init (không tạo BossInstance nào) để tránh tuần lỗi.
      const insufficient: Array<{ grade: number; have: number; need: number }> = [];
      for (const grade of grades) {
        const alreadyInit = await BossInstanceModel.exists({ weekKey, gradeLevel: grade });
        if (alreadyInit) continue;
        const cfg = await BossWeeklyConfigService.getEffectiveConfig(weekKey, grade);
        const need = cfg.questionsPerWeek;
        const have = await BossQuestionService.countActiveByGrade(grade);
        if (have < need) insufficient.push({ grade, have, need });
      }
      if (insufficient.length > 0) {
        const detail = insufficient
          .map((x) => `Khối ${x.grade} (có ${x.have}/${x.need})`)
          .join(', ');
        throw new Error(
          `Không đủ câu hỏi để khởi tạo tuần. Mỗi khối cần đủ số câu hỏi trong kho: ${detail}. Vui lòng bổ sung câu hỏi rồi thử lại.`,
        );
      }

      const initialized: number[] = [];
      const skipped: number[] = [];

      for (const grade of grades) {
        // Effective config = merge(global template, per-(week,grade) override)
        const config = await BossWeeklyConfigService.getEffectiveConfig(weekKey, grade);
        const existing = await BossInstanceModel.findOne({ weekKey, gradeLevel: grade });
        if (existing) {
          skipped.push(grade);
        } else {
          try {
            await BossInstanceModel.create({
              weekKey,
              gradeLevel: grade,
              config,
              totalPointsEarned: 0,
              progressPercent: 0,
              currentBossStateImg: pickInitialBossImage(config),
              status: 'ACTIVE',
            });
            initialized.push(grade);
          } catch (err: any) {
            // Duplicate-key race → coi như skipped
            if (err?.code === 11000) {
              skipped.push(grade);
            } else {
              throw err;
            }
          }
        }

        // Auto-generate 7 sets (no force)
        await QuestionSetService.autoGenerate(weekKey, grade, false);
      }

      // Đóng tuần trước nếu chưa đóng
      const previousWeekKey = getPreviousWeekKey(weekKey);
      let closedPrev = false;
      const hasPrev = await BossInstanceModel.exists({ weekKey: previousWeekKey });
      if (hasPrev) {
        const hasHonor = await WeeklyHonorModel.exists({ weekKey: previousWeekKey });
        if (!hasHonor) {
          await this.closeWeek(previousWeekKey, BOSS_BATTLE_HONOR_TOP_N).catch((err) => {
            console.error('[BossBattle] closeWeek previous failed:', err);
          });
          closedPrev = true;
        }
      }

      return {
        weekKey,
        initializedGrades: initialized,
        skippedGrades: skipped,
        closedPreviousWeek: closedPrev,
        previousWeekKey: hasPrev ? previousWeekKey : undefined,
      };
    } finally {
      await releaseLock(lockKey);
    }
  }

  /**
   * FLW-02: Chốt BXH cuối tuần → tạo WeeklyHonor cho Top N từng grade.
   * Idempotent: nếu đã có honor cho weekKey+grade thì skip.
   */
  static async closeWeek(weekKey: string, topN = BOSS_BATTLE_HONOR_TOP_N): Promise<CloseWeekResult> {
    const lockKey = `${BOSS_BATTLE_REDIS_KEYS.CLOSE_WEEK_LOCK}:${weekKey}`;
    const locked = await acquireLock(lockKey, BOSS_BATTLE_CYCLE_LOCK_TTL);
    if (!locked) throw new Error(`Close week already in progress: ${weekKey}`);

    try {
      const config = await GameConfigService.getBossBattleConfig().catch(() => DEFAULT_BOSS_BATTLE_CONFIG);
      const frameValidDays = BOSS_BATTLE_FRAME_VALID_DAYS;
      const expiry = new Date(Date.now() + frameValidDays * 24 * 60 * 60 * 1000);
      const honorsCreated: { gradeLevel: number; count: number }[] = [];

      const instances = await BossInstanceModel.find({ weekKey }).lean();

      for (const instance of instances) {
        const grade = instance.gradeLevel;
        const hasHonor = await WeeklyHonorModel.exists({ weekKey, gradeLevel: grade });
        if (hasHonor) {
          honorsCreated.push({ gradeLevel: grade, count: 0 });
          continue;
        }

        const topProgress = await StudentBossProgressModel.find({
          weekKey,
          gradeLevel: grade,
          correctCountWeek: { $gt: 0 },
        })
          .sort(RANK_SORT)
          .limit(topN)
          .lean();

        if (topProgress.length === 0) {
          honorsCreated.push({ gradeLevel: grade, count: 0 });
          continue;
        }

        // Standard competition ranking + đồng hạng khi trùng cả 4 tiêu chí
        const ranks = assignRanks(topProgress);

        const studentIds = topProgress.map((p: any) => p.studentId);
        const users = await UserModel.find({ userId: { $in: studentIds } }).lean();
        const userMap = new Map<string, any>(users.map((u: any) => [u.userId, u]));

        const honorDocs = topProgress.map((p: any, idx: number) => {
          const u = userMap.get(p.studentId);
          return {
            weekKey,
            gradeLevel: grade,
            studentId: p.studentId,
            displayName: u?.name ?? p.studentId,
            avatar: u?.avatar,
            rank: ranks[idx].rank,
            correctCountWeek: p.correctCountWeek,
            totalCorrectTimeSec: p.totalCorrectTimeSec,
            pointsContributedWeek: p.pointsContributedWeek,
            frameGranted: config.weeklyFrameImageUrl ? true : false,
            frameExpiry: expiry,
            bannerActive: true,
          };
        });

        try {
          await WeeklyHonorModel.insertMany(honorDocs, { ordered: false });
        } catch (err: any) {
          // Duplicate races: ignore E11000
          if (err?.code !== 11000) throw err;
        }
        honorsCreated.push({ gradeLevel: grade, count: honorDocs.length });
      }

      // Đóng tất cả BossInstance của tuần này → chặn người chơi tiếp tục
      await BossInstanceModel.updateMany(
        { weekKey, status: { $in: ['ACTIVE', 'DEFEATED'] } },
        { $set: { status: 'CLOSED', closedAt: new Date() } },
      );

      return { weekKey, honorsCreated };
    } finally {
      await releaseLock(lockKey);
    }
  }

  /**
   * FLW-08: Đặt bannerActive=false cho các honor đã quá frameExpiry.
   */
  static async expireHonors(now: Date = new Date()): Promise<{ updated: number }> {
    const result = await WeeklyHonorModel.updateMany(
      { frameExpiry: { $lt: now }, bannerActive: true },
      { $set: { bannerActive: false } },
    );
    return { updated: result.modifiedCount ?? 0 };
  }

  /** Lấy danh sách honor hiện tại còn hiệu lực theo grade */
  static async getCurrentHonors(gradeLevel: number, now: Date = new Date()): Promise<WeeklyHonor[]> {
    const docs = await WeeklyHonorModel.find({
      gradeLevel,
      frameExpiry: { $gte: now },
      bannerActive: true,
    })
      .sort({ weekKey: -1, rank: 1 })
      .lean();
    return docs.map((d: any) => ({
      id: String(d._id),
      weekKey: d.weekKey,
      gradeLevel: d.gradeLevel,
      studentId: d.studentId,
      displayName: d.displayName,
      avatar: d.avatar,
      rank: d.rank,
      correctCountWeek: d.correctCountWeek,
      totalCorrectTimeSec: d.totalCorrectTimeSec,
      pointsContributedWeek: d.pointsContributedWeek,
      frameGranted: d.frameGranted,
      frameExpiry: d.frameExpiry,
      bannerActive: d.bannerActive,
      createdAt: d.createdAt,
    }));
  }

  /** Lấy honors theo weekKey (cho monitor) */
  static async getHonorsByWeek(weekKey: string, gradeLevel?: number): Promise<WeeklyHonor[]> {
    const filter: Record<string, unknown> = { weekKey };
    if (gradeLevel !== undefined) filter.gradeLevel = gradeLevel;
    const docs = await WeeklyHonorModel.find(filter).sort({ gradeLevel: 1, rank: 1 }).lean();
    return docs.map((d: any) => ({
      id: String(d._id),
      weekKey: d.weekKey,
      gradeLevel: d.gradeLevel,
      studentId: d.studentId,
      displayName: d.displayName,
      avatar: d.avatar,
      rank: d.rank,
      correctCountWeek: d.correctCountWeek,
      totalCorrectTimeSec: d.totalCorrectTimeSec,
      pointsContributedWeek: d.pointsContributedWeek,
      frameGranted: d.frameGranted,
      frameExpiry: d.frameExpiry,
      bannerActive: d.bannerActive,
      createdAt: d.createdAt,
    }));
  }
}
