// ============================================================
// Shared Common Constants — dùng chung cho mọi nhóm game
// ============================================================

/** Redis key prefixes (common) */
export const REDIS_KEYS = {
  GAME_CONFIG: 'game:config',
  USER_SCORE: 'user:score',
  /**
   * Cache thông tin người dùng: user:profile:{userId}
   * Value: JSON của UserProfile
   * TTL: 10 phút, refresh khi upsert
   */
  USER_PROFILE: 'user:profile',
  /** Sorted Set: leaderboard:{scope} — scope = total | mind_game | gomoku | ... */
  LEADERBOARD: 'leaderboard',
  /**
   * Track session đang active của user: user:active-session:{userId}
   * Value: "{sessionId}:{gameType}"
   * Dùng để chặn user join matchmaking mới khi đang trong session cũ.
   */
  USER_ACTIVE_SESSION: 'user:active-session',
  /**
   * Cache pool bot profiles: bot:profiles
   * Value: JSON array của BotProfile[]
   * TTL: 1 giờ, refresh khi có thay đổi từ CMS
   */
  BOT_PROFILES: 'bot:profiles',
} as const;

/** Thời gian cache user profile (giây) — 10 phút */
export const USER_PROFILE_CACHE_TTL = 600;

/** Thời gian cache bot profiles (giây) — 1 giờ */
export const BOT_PROFILES_CACHE_TTL = 3600;

/** Socket events (common) */
export const SOCKET_EVENTS = {
  ERROR: 'game:error',
} as const;
