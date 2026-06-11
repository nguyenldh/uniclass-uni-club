// ============================================================
// Weekly Event — Config Service
// Quản lý WeeklyEventGeneralConfig (DATA-M-001) singleton
// ============================================================

import { redis } from '../../../config/index';
import { WeeklyEventGeneralConfigModel } from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_CONFIG_CACHE_TTL,
  DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG,
} from '@uniclub/shared';
import type { WeeklyEventGeneralConfig, UpdateGeneralConfigInput } from '@uniclub/shared';

export class WeeklyEventConfigService {
  /**
   * Lấy general config — ưu tiên Redis cache, fallback MongoDB.
   * Nếu chưa có trong DB, trả về default.
   */
  static async getGeneralConfig(): Promise<WeeklyEventGeneralConfig> {
    const cacheKey = WEEKLY_EVENT_REDIS_KEYS.GENERAL_CONFIG;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let doc = await WeeklyEventGeneralConfigModel.findById('singleton').lean();
    if (!doc) {
      await WeeklyEventGeneralConfigModel.create({
        _id: 'singleton',
        ...DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG,
      });
      doc = await WeeklyEventGeneralConfigModel.findById('singleton').lean();
    }

    if (!doc) {
      return { ...DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG };
    }

    const config: WeeklyEventGeneralConfig = {
      defaultWaitingDuration: doc.defaultWaitingDuration,
      defaultExamDuration: doc.defaultExamDuration,
      defaultLeaderboardDuration: doc.defaultLeaderboardDuration,
      leaderboardLimit: doc.leaderboardLimit,
      defaultActiveGrades: doc.defaultActiveGrades,
      timezone: doc.timezone,
      updatedAt: (doc as any).updatedAt?.toISOString(),
      updatedBy: (doc as any).updatedBy,
    };

    await redis.set(cacheKey, JSON.stringify(config), 'EX', WEEKLY_EVENT_CONFIG_CACHE_TTL);
    return config;
  }

  /**
   * Cập nhật general config từ CMS.
   */
  static async updateGeneralConfig(
    input: UpdateGeneralConfigInput,
    adminId: string,
  ): Promise<WeeklyEventGeneralConfig> {
    const update: Record<string, unknown> = { updatedBy: adminId };
    if (input.defaultWaitingDuration !== undefined) update.defaultWaitingDuration = input.defaultWaitingDuration;
    if (input.defaultExamDuration !== undefined) update.defaultExamDuration = input.defaultExamDuration;
    if (input.defaultLeaderboardDuration !== undefined) update.defaultLeaderboardDuration = input.defaultLeaderboardDuration;
    if (input.leaderboardLimit !== undefined) update.leaderboardLimit = input.leaderboardLimit;
    if (input.defaultActiveGrades !== undefined) update.defaultActiveGrades = input.defaultActiveGrades;
    if (input.timezone !== undefined) update.timezone = input.timezone;

    await WeeklyEventGeneralConfigModel.findByIdAndUpdate(
      'singleton',
      { $set: update },
      { upsert: true, new: true },
    );

    await this.invalidateCache();
    return this.getGeneralConfig();
  }

  /**
   * Xóa cache Redis của general config.
   */
  static async invalidateCache(): Promise<void> {
    await redis.del(WEEKLY_EVENT_REDIS_KEYS.GENERAL_CONFIG);
  }
}
