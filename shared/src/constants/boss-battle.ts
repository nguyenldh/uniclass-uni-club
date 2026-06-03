// ============================================================
// Boss Battle Constants
// ============================================================

import type { BossBattleConfig, OverridableBossBattleConfigKey } from '../types/boss-battle';

// ---- Default Config ----

export const DEFAULT_BOSS_BATTLE_CONFIG: BossBattleConfig = {
  hpMax: 50000,
  questionsPerDay: 5,
  questionsPerWeek: 35,
  basePoint: 10,
  maxSpeedBonus: 5,
  tMaxSec: 60,
  bossName: 'Hắc Long Tri Thức',
  bossStates: [
    { minPercent: 71, maxPercent: 100, img: 'boss_dragon_normal.png' },
    { minPercent: 41, maxPercent: 70, img: 'boss_dragon_injured.png' },
    { minPercent: 0, maxPercent: 40, img: 'boss_dragon_rage.png' },
  ],
  weeklyFrameImageUrl: '',
};

// ---- Redis keys ----

export const BOSS_BATTLE_REDIS_KEYS = {
  /** Cache config: boss-battle:config */
  CONFIG: 'boss-battle:config',
  /** Cache BossInstance: boss-battle:instance:<weekKey>:<grade> */
  INSTANCE: 'boss-battle:instance',
  /**
   * Lưu currentQuestionStartedAt (ms) cho từng (attemptId, questionId):
   *   boss-battle:attempt:<attemptId>:question:<questionId>
   * Server tự tính responseTimeSec từ key này (chống cheat client-side).
   */
  ATTEMPT_QUESTION_STARTED: 'boss-battle:attempt-question-started',
  /** Cache leaderboard: boss-battle:leaderboard:<weekKey>:<grade> */
  LEADERBOARD: 'boss-battle:leaderboard',
  /** Lock khi init-week để tránh race multi-instance: boss-battle:lock:init:<weekKey> */
  INIT_WEEK_LOCK: 'boss-battle:lock:init',
  /** Lock khi close-week: boss-battle:lock:close:<weekKey> */
  CLOSE_WEEK_LOCK: 'boss-battle:lock:close',
} as const;

// ---- Cache TTL (giây) ----

/** TTL cache config (5 phút) */
export const BOSS_BATTLE_CONFIG_CACHE_TTL = 300;
/** TTL cache BossInstance (60 giây) */
export const BOSS_BATTLE_INSTANCE_CACHE_TTL = 60;
/** TTL cache leaderboard (30 giây) */
export const BOSS_BATTLE_LEADERBOARD_CACHE_TTL = 30;
/** TTL lock init/close week (60 giây) */
export const BOSS_BATTLE_CYCLE_LOCK_TTL = 60;

// ---- Socket events (BXH realtime broadcast) ----

export const BOSS_BATTLE_SOCKET_EVENTS = {
  /**
   * Client → Server: join room theo (weekKey, grade) để nhận leaderboard update.
   * Payload: { weekKey: string, gradeLevel: number }
   */
  JOIN_ROOM: 'boss-battle:join-room',
  /** Client → Server: rời room. Payload: { weekKey, gradeLevel } */
  LEAVE_ROOM: 'boss-battle:leave-room',
  /**
   * Server → Client: BXH cập nhật.
   * Payload: BossLeaderboardResponse (top entries, không có myEntry)
   */
  LEADERBOARD_UPDATE: 'boss-battle:leaderboard-update',
  /**
   * Server → Client: HP Boss thay đổi.
   * Payload: { weekKey, gradeLevel, totalPointsEarned, progressPercent, currentBossStateImg, status }
   */
  BOSS_HP_UPDATE: 'boss-battle:hp-update',
  /**
   * Server → Client: Boss đã bị hạ.
   * Payload: { weekKey, gradeLevel, defeatedAt }
   */
  BOSS_DEFEATED: 'boss-battle:defeated',
} as const;

// ---- Constants ----

/** Số lượng HS được vinh danh mỗi khối cuối tuần */
export const BOSS_BATTLE_HONOR_TOP_N = 10;

/** Số ngày trong một tuần Boss (1..7) */
export const BOSS_BATTLE_DAYS_PER_WEEK = 7;

/** Số ngày khung avatar "Dũng sĩ diệt Boss" còn hiệu lực sau khi cấp */
export const BOSS_BATTLE_FRAME_VALID_DAYS = 7;

/** Prefix tên Socket.IO room theo (weekKey, grade): `${prefix}:${weekKey}:${grade}` */
export const BOSS_BATTLE_ROOM_PREFIX = 'boss-battle:room';

/** Danh sách field của BossBattleConfig có thể override theo (tuần × khối). */
export const OVERRIDABLE_BOSS_BATTLE_FIELDS: readonly OverridableBossBattleConfigKey[] = [
  'hpMax',
  'questionsPerDay',
  'questionsPerWeek',
  'basePoint',
  'maxSpeedBonus',
  'tMaxSec',
  'bossName',
  'bossStates',
] as const;

/** Danh sách khối lớp được phép tham gia Săn Boss — dùng làm pool chọn. Tuần cụ thể có thể chỉ mở tập con. */
export const BOSS_BATTLE_GRADES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;
