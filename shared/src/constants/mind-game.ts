// ============================================================
// Mind Game Constants — Đấu trí (Gomoku & Card Flip)
// ============================================================

import type { GomokuConfig, CardFlipConfig } from '../types/mind-game';

/** Redis key prefixes (mind-game) */
export const MIND_GAME_REDIS_KEYS = {
  MATCHMAKING_QUEUE: 'mind-game:matchmaking:queue',
  GOMOKU_SESSION: 'mind-game:gomoku:session',
  CARD_FLIP_SESSION: 'mind-game:card-flip:session',
} as const;

/** Socket events (mind-game) */
export const MIND_GAME_SOCKET_EVENTS = {
  // Matchmaking
  JOIN_MATCHMAKING: 'mind-game:matchmaking:join',
  LEAVE_MATCHMAKING: 'mind-game:matchmaking:leave',
  MATCHMAKING_MATCHED: 'mind-game:matchmaking:matched',
  MATCHMAKING_TIMEOUT: 'mind-game:matchmaking:timeout',

  // Gomoku
  GOMOKU_MOVE: 'mind-game:gomoku:move',
  GOMOKU_STATE: 'mind-game:gomoku:state',
  GOMOKU_END: 'mind-game:gomoku:end',
  GOMOKU_OPPONENT_DISCONNECTED: 'mind-game:gomoku:opponent_disconnected',

  // Card Flip (Lật thẻ PvP)
  CARD_FLIP_START: 'mind-game:card-flip:start',
  CARD_FLIP_FLIP: 'mind-game:card-flip:flip',
  CARD_FLIP_STATE: 'mind-game:card-flip:state',
  CARD_FLIP_END: 'mind-game:card-flip:end',
  CARD_FLIP_TURN: 'mind-game:card-flip:turn',
} as const;

/** Default Gomoku config */
export const DEFAULT_GOMOKU_CONFIG: GomokuConfig = {
  matchmakingTimeout: 5,
  winPoints: 100,
  boardSize: 15,
};

/** Default Card Flip config */
export const DEFAULT_CARD_FLIP_CONFIG: CardFlipConfig = {
  matchmakingTimeout: 30,
  winPoints: 50,
  pairCount: 15,
};

/** Emoji pool cho Card Flip / Memory Match */
export const CARD_EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
];

/** Gomoku board size */
export const GOMOKU_BOARD_SIZE = 15;

/** Số quân liên tiếp để thắng */
export const GOMOKU_WIN_STREAK = 5;

/** Thời gian tối đa cho một nước đi Gomoku (giây) */
export const GOMOKU_MOVE_TIMEOUT = 30;

/** Số lượt gần nhất bot lật thẻ có thể nhớ (1 lượt = 2 thẻ lật). Điều chỉnh để tăng/giảm độ khó AI. */
export const BOT_CARD_FLIP_MEMORY_TURNS = 3;
