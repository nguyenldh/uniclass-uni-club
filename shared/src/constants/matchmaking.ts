// ============================================================
// Matchmaking Constants — game-agnostic, tái sử dụng cho mọi game PvP
// ============================================================

/** Redis key prefixes cho matchmaking */
export const MATCHMAKING_REDIS_KEYS = {
  /** Queue prefix: matchmaking:queue:{gameType} */
  QUEUE: 'matchmaking:queue',
} as const;

/** Socket events cho matchmaking (game-agnostic) */
export const MATCHMAKING_SOCKET_EVENTS = {
  JOIN_MATCHMAKING: 'matchmaking:join',
  LEAVE_MATCHMAKING: 'matchmaking:leave',
  MATCHMAKING_MATCHED: 'matchmaking:matched',
  MATCHMAKING_TIMEOUT: 'matchmaking:timeout',
} as const;

/** Default matchmaking config */
export const DEFAULT_MATCHMAKING_CONFIG = {
  /** Thời gian tối đa chờ ghép trận (giây) */
  timeout: 30,
} as const;
