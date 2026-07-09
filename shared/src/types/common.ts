// ============================================================
// Shared Common Types — dùng chung cho mọi nhóm game
// ============================================================

/** Trạng thái của một game session */
export type GameSessionStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';

/** Mức độ khó của AI */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

/** Trạng thái matchmaking */
export type MatchmakingStatus = 'searching' | 'matched' | 'timeout';

/**
 * Chế độ ghép đối thủ cho một game PvP:
 * - `mixed`: tìm người thật trước (0 → botActivationSeconds), sau đó cho phép ghép bot.
 * - `bot_only`: luôn ghép bot, không bao giờ tìm người thật (vẫn hiển thị màn "đang tìm").
 */
export type OpponentMode = 'mixed' | 'bot_only';

/** Nhóm game (danh mục lớn) */
export type GameType = 'mind_game' | 'quiz_arena' | 'boss_battle' | 'weekly_event';

// ---- User Score ----

/** Điểm số của một game/mục cụ thể */
export interface GameScoreDetail {
  points: number;
  played: number;
  won: number;
}

export interface UserScore {
  userId: string;
  /** Tổng điểm toàn bộ */
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  /** Điểm theo nhóm game */
  mind_game: GameScoreDetail;
  quiz_arena: GameScoreDetail;
  boss_battle: GameScoreDetail;
  weekly_event: GameScoreDetail;
  /** Điểm theo game con (mind-game) */
  gomoku: GameScoreDetail;
  card_flip: GameScoreDetail;
  lastPlayedAt?: Date;
}

// ---- Auth User (JWT payload / API response) ----

export interface AuthUser {
  profileId?: string;
  userId: string;
  name: string;
  /** Khối lớp của học sinh (6-12). UniClass cấp khi sinh token. */
  grade?: number;
  /** Có thể mở rộng thêm: avatar, role, ... */
  avatar?: string;
  /**
   * Loại tài khoản: `user` (học sinh thường) hoặc `guest` (khách được mời).
   * Lấy từ payload JWT (`payload.user.type`). Mặc định `user` nếu token không có.
   * Dùng cho các cơ chế hiển thị/logic phân biệt guest ở FE.
   */
  type?: 'user' | 'guest';
}

// ---- Bot Profile (AI Bot Identity Pool) ----

/** Hồ sơ bot AI — được lấy ngẫu nhiên từ pool cho mỗi session */
export interface BotProfile {
  /** MongoDB _id (string representation) */
  id: string;
  /** Tên hiển thị của bot */
  name: string;
  /** URL avatar của bot */
  avatar: string;
  /** Bot có đang active không (cho phép lọc bot không còn dùng) */
  isActive: boolean;
  /** Thời điểm tạo */
  createdAt?: Date;
  /** Thời điểm cập nhật cuối */
  updatedAt?: Date;
}

/** Dữ liệu tạo mới bot profile (không có id) */
export type CreateBotProfileInput = Omit<BotProfile, 'id' | 'createdAt' | 'updatedAt'>;

/** Dữ liệu cập nhật bot profile (tất cả optional) */
export type UpdateBotProfileInput = Partial<CreateBotProfileInput>;

// ---- Game Config (CMS) — generic container ----

export interface GameConfig<T = unknown> {
  gameType: string;
  config: T;
  updatedAt?: Date;
}
