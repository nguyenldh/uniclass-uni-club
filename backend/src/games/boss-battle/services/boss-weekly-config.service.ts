// ============================================================
// Boss Battle — Weekly Config Service
// Quản lý override BossBattleConfig theo (weekKey × gradeLevel).
// Effective config = merge(global template, overrides).
// ============================================================

import { BossWeeklyConfigModel, BossInstanceModel } from '../../../models/index';
import { GameConfigService } from '../../../services/game-config.service';
import { isWeekStarted } from '../utils/week';
import { pickBossImage } from './boss-battle.service';
import {
  OVERRIDABLE_BOSS_BATTLE_FIELDS,
} from '@uniclub/shared';
import type {
  BossBattleConfig,
  BossBattleConfigOverride,
  BossWeeklyConfig,
  OverridableBossBattleConfigKey,
} from '@uniclub/shared';

/** Loại bỏ mọi key không thuộc whitelist override */
function sanitizeOverrides(input: unknown): BossBattleConfigOverride {
  if (!input || typeof input !== 'object') return {};
  const src = input as Record<string, unknown>;
  const out: BossBattleConfigOverride = {};
  for (const key of OVERRIDABLE_BOSS_BATTLE_FIELDS) {
    if (src[key] !== undefined && src[key] !== null) {
      (out as Record<string, unknown>)[key] = src[key];
    }
  }
  return out;
}

/** Validate giá trị override; trả về null nếu OK, hoặc message lỗi */
function validateOverrides(o: BossBattleConfigOverride): string | null {
  if (o.hpMax !== undefined && (!Number.isFinite(o.hpMax) || o.hpMax <= 0)) {
    return 'hpMax must be > 0';
  }
  if (
    o.questionsPerDay !== undefined &&
    (!Number.isFinite(o.questionsPerDay) || o.questionsPerDay <= 0)
  ) {
    return 'questionsPerDay must be > 0';
  }
  if (
    o.questionsPerWeek !== undefined &&
    (!Number.isFinite(o.questionsPerWeek) || o.questionsPerWeek <= 0)
  ) {
    return 'questionsPerWeek must be > 0';
  }
  if (o.basePoint !== undefined && (!Number.isFinite(o.basePoint) || o.basePoint < 0)) {
    return 'basePoint must be >= 0';
  }
  if (
    o.maxSpeedBonus !== undefined &&
    (!Number.isFinite(o.maxSpeedBonus) || o.maxSpeedBonus < 0)
  ) {
    return 'maxSpeedBonus must be >= 0';
  }
  if (o.tMaxSec !== undefined && (!Number.isFinite(o.tMaxSec) || o.tMaxSec <= 0)) {
    return 'tMaxSec must be > 0';
  }
  if (o.bossStates !== undefined) {
    if (!Array.isArray(o.bossStates) || o.bossStates.length === 0) {
      return 'bossStates must have at least one entry';
    }
    for (const s of o.bossStates) {
      if (
        !s ||
        typeof s !== 'object' ||
        typeof s.img !== 'string' ||
        !Number.isFinite(s.minPercent) ||
        !Number.isFinite(s.maxPercent)
      ) {
        return 'bossStates entry invalid';
      }
    }
  }
  if (o.bossName !== undefined && typeof o.bossName !== 'string') {
    return 'bossName must be string';
  }
  return null;
}

function mergeConfig(
  base: BossBattleConfig,
  overrides: BossBattleConfigOverride,
): BossBattleConfig {
  return { ...base, ...overrides };
}

export class BossWeeklyConfigService {
  /** Lấy override thô (chưa merge) — null nếu không có */
  static async getOverride(
    weekKey: string,
    gradeLevel: number,
  ): Promise<BossBattleConfigOverride | null> {
    const doc = await BossWeeklyConfigModel.findOne({ weekKey, gradeLevel }).lean();
    if (!doc) return null;
    return sanitizeOverrides(doc.overrides);
  }

  /** Lấy config thực tế áp dụng cho (weekKey, grade) */
  static async getEffectiveConfig(
    weekKey: string,
    gradeLevel: number,
  ): Promise<BossBattleConfig> {
    const [global, override] = await Promise.all([
      GameConfigService.getBossBattleConfig(),
      BossWeeklyConfigService.getOverride(weekKey, gradeLevel),
    ]);
    return mergeConfig(global, override ?? {});
  }

  /** Upsert override; trả về entry với effectiveConfig + hasInstance + weekStarted.
   *  - Nếu tuần đã bắt đầu chạy (now >= Monday weekKey) → throw để tránh sửa khi đang diễn ra.
   *  - Nếu tuần đã init nhưng chưa chạy → re-snapshot effective config vào BossInstance.config.
   */
  static async upsert(
    weekKey: string,
    gradeLevel: number,
    overrides: BossBattleConfigOverride,
  ): Promise<BossWeeklyConfig> {
    // if (isWeekStarted(weekKey)) {
    //   throw new Error(`Week ${weekKey} đã bắt đầu — không thể chỉnh override`);
    // }
    const clean = sanitizeOverrides(overrides);
    const err = validateOverrides(clean);
    if (err) throw new Error(err);

    await BossWeeklyConfigModel.findOneAndUpdate(
      { weekKey, gradeLevel },
      { $set: { overrides: clean } },
      { upsert: true, new: true },
    ).lean();

    const [doc, global, instance] = await Promise.all([
      BossWeeklyConfigModel.findOne({ weekKey, gradeLevel }).lean(),
      GameConfigService.getBossBattleConfig(),
      BossInstanceModel.exists({ weekKey, gradeLevel }),
    ]);

    const effective = mergeConfig(global, clean);

    // Re-sync snapshot vào BossInstance.config + tính lại currentBossStateImg
    if (instance) {
      const inst = await BossInstanceModel.findOne({ weekKey, gradeLevel }).lean();
      const newImg = pickBossImage(effective, inst?.progressPercent ?? 0);
      await BossInstanceModel.updateOne(
        { weekKey, gradeLevel },
        { $set: { config: effective, currentBossStateImg: newImg } },
      );
    }

    return {
      id: doc ? String(doc._id) : undefined,
      weekKey,
      gradeLevel,
      overrides: clean,
      effectiveConfig: effective,
      hasInstance: Boolean(instance),
      weekStarted: false,
      createdAt: doc?.createdAt,
      updatedAt: doc?.updatedAt,
    };
  }

  /** Xóa override hoàn toàn → effective rơi về global template.
   *  - Nếu tuần đã chạy → throw.
   *  - Nếu tuần đã init nhưng chưa chạy → re-snapshot global vào BossInstance.config.
   */
  static async remove(weekKey: string, gradeLevel: number): Promise<boolean> {
    if (isWeekStarted(weekKey)) {
      throw new Error(`Week ${weekKey} đã bắt đầu — không thể reset override`);
    }
    const r = await BossWeeklyConfigModel.deleteOne({ weekKey, gradeLevel });
    const instance = await BossInstanceModel.exists({ weekKey, gradeLevel });
    if (instance) {
      const global = await GameConfigService.getBossBattleConfig();
      const inst = await BossInstanceModel.findOne({ weekKey, gradeLevel }).lean();
      const newImg = pickBossImage(global, inst?.progressPercent ?? 0);
      await BossInstanceModel.updateOne(
        { weekKey, gradeLevel },
        { $set: { config: global, currentBossStateImg: newImg } },
      );
    }
    return r.deletedCount > 0;
  }

  /**
   * List entries cho 1 tuần.
   * - Nếu `grades` được truyền: trả về đúng các khối đó (kể cả chưa có override → entry rỗng).
   * - Nếu không truyền: trả về đúng các khối "đang mở" cho tuần — union(override grades, instance grades).
   *   Trả về mảng rỗng nếu tuần này chưa cấu hình khối nào.
   */
  static async listByWeek(
    weekKey: string,
    grades?: number[],
  ): Promise<BossWeeklyConfig[]> {
    const [global, allOverrideDocs, allInstanceDocs] = await Promise.all([
      GameConfigService.getBossBattleConfig(),
      BossWeeklyConfigModel.find({ weekKey }).lean(),
      BossInstanceModel.find({ weekKey }).select('gradeLevel').lean(),
    ]);

    const overrideMap = new Map<number, (typeof allOverrideDocs)[number]>();
    for (const d of allOverrideDocs) overrideMap.set(d.gradeLevel, d);
    const instanceSet = new Set<number>(allInstanceDocs.map((d) => d.gradeLevel));

    let gradeList: number[];
    if (grades && grades.length > 0) {
      gradeList = [...new Set(grades)].sort((a, b) => a - b);
    } else {
      const active = new Set<number>([...overrideMap.keys(), ...instanceSet]);
      gradeList = [...active].sort((a, b) => a - b);
    }

    const weekStarted = isWeekStarted(weekKey);

    return gradeList.map((g) => {
      const doc = overrideMap.get(g);
      const overrides = doc ? sanitizeOverrides(doc.overrides) : {};
      return {
        id: doc ? String(doc._id) : undefined,
        weekKey,
        gradeLevel: g,
        overrides,
        effectiveConfig: mergeConfig(global, overrides),
        hasInstance: instanceSet.has(g),
        weekStarted,
        createdAt: doc?.createdAt,
        updatedAt: doc?.updatedAt,
      };
    });
  }

  /** Lấy 1 entry (kể cả khi chưa có override) */
  static async getByKey(weekKey: string, gradeLevel: number): Promise<BossWeeklyConfig> {
    const [list] = await Promise.all([BossWeeklyConfigService.listByWeek(weekKey, [gradeLevel])]);
    return list[0];
  }

  /**
   * Trả về danh sách các weekKey đã có ít nhất một BossInstance (đã init).
   * Dùng cho CMS để disable các tuần đã khởi tạo trong picker.
   */
  static async listInitializedWeeks(): Promise<string[]> {
    const keys = (await BossInstanceModel.distinct('weekKey')) as string[];
    return keys.sort();
  }

  /**
   * Copy overrides từ sourceWeek → targetWeek. Nếu overwrite=false, chỉ copy khối chưa có override
   * ở target. Trả về số bản ghi đã ghi (insert hoặc update).
   */
  static async copyFromWeek(
    sourceWeekKey: string,
    targetWeekKey: string,
    grades?: number[],
    overwrite = false,
  ): Promise<number> {
    if (sourceWeekKey === targetWeekKey) {
      throw new Error('sourceWeekKey must differ from targetWeekKey');
    }
    const filter: Record<string, unknown> = { weekKey: sourceWeekKey };
    if (grades && grades.length > 0) filter.gradeLevel = { $in: grades };

    const sourceDocs = await BossWeeklyConfigModel.find(filter).lean();
    if (sourceDocs.length === 0) return 0;

    let written = 0;
    for (const src of sourceDocs) {
      const clean = sanitizeOverrides(src.overrides);
      if (Object.keys(clean).length === 0) continue;

      const existing = await BossWeeklyConfigModel.findOne({
        weekKey: targetWeekKey,
        gradeLevel: src.gradeLevel,
      }).lean();

      if (existing && !overwrite) continue;

      await BossWeeklyConfigModel.findOneAndUpdate(
        { weekKey: targetWeekKey, gradeLevel: src.gradeLevel },
        { $set: { overrides: clean } },
        { upsert: true },
      );
      written++;
    }
    return written;
  }
}

export type { OverridableBossBattleConfigKey };
