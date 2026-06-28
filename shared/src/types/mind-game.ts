// ============================================================
// Mind Game Types — Đấu trí (Gomoku & Card Flip)
// ============================================================

import type { GameSessionStatus, AIDifficulty, OpponentMode } from './common';

/** Các game trong nhóm Mind Game */
export type MindGameType = 'gomoku' | 'card_flip';

// ---- Card Flip (Lật thẻ PvP) ----

/** Một item dùng làm mặt trước của thẻ (emoji hoặc link ảnh). */
export interface CardFlipItem {
  type: 'emoji' | 'image';
  /** Nếu type='emoji': ký tự emoji. Nếu type='image': URL ảnh. */
  value: string;
}

/**
 * Chế độ chơi Lật thẻ — người chơi chọn trước khi tìm trận.
 * - `basic`:    1 đồng hồ CHUNG cho cả trận (chạy liên tục). Hết giờ / lật hết → điểm cao thắng.
 * - `advanced`: đồng hồ CỜ VUA — mỗi người 1 quỹ giờ riêng, chỉ chạy trong lượt của mình;
 *               ghép đúng +bonus giờ & giữ lượt; hết quỹ giờ → thua ngay.
 */
export type CardFlipMode = 'basic' | 'advanced';

export interface CardFlipConfig {
  /** Thời gian tối đa ghép trận PvP (giây) */
  matchmakingTimeout: number;
  /**
   * Chế độ ghép đối thủ: `mixed` (tìm người thật rồi mới bot) hoặc `bot_only` (chỉ bot).
   */
  opponentMode: OpponentMode;
  /**
   * Mốc (giây, tính từ lúc bắt đầu tìm) phân chia giai đoạn tìm người thật và giai đoạn ghép bot.
   * Chỉ áp dụng khi `opponentMode = 'mixed'`. Mặc định ≈ 50% của `matchmakingTimeout`.
   * 0 → botActivationSeconds: chỉ tìm người thật. Sau đó bot được ghép tại một thời điểm
   * ngẫu nhiên trong khoảng [botActivationSeconds, matchmakingTimeout].
   */
  botActivationSeconds: number;
  /** Điểm thưởng khi thắng */
  winPoints: number;
  /** Số cặp thẻ */
  pairCount: number;
  /** Danh sách item hình nền mặt trước thẻ. Nếu rỗng/undefined → dùng CARD_EMOJIS mặc định. */
  cardItems?: CardFlipItem[];
  /**
   * Chế độ Cơ bản: tổng thời gian chơi CỐ ĐỊNH của cả trận (giây). Hết giờ → điểm cao thắng / hòa.
   */
  basicTotalTime: number;
  /**
   * Chế độ Nâng cao: quỹ thời gian xuất phát của MỖI người chơi (giây).
   */
  advancedStartTime: number;
  /**
   * Chế độ Nâng cao: thời gian cộng thêm vào quỹ giờ khi ghép đúng một cặp (giây).
   */
  timeBonusOnMatch: number;
  /**
   * Chế độ Cơ bản: thời gian tối đa cho một lượt (giây). Hết giờ → tự động chuyển lượt (auto-pass),
   * KHÔNG xử thua. Chống treo khi người chơi AFK. Không áp dụng cho chế độ Nâng cao.
   */
  turnTimeout: number;
  /**
   * Tốc độ lật thẻ của bot (mili giây) — độ trễ giữa các thao tác lật của AI.
   * Số càng lớn bot lật càng chậm. Lưu ý: ở chế độ Nâng cao, độ trễ này tiêu vào quỹ giờ của bot.
   */
  botFlipDelayMs: number;
}

export interface CardFlipCard {
  id: number;
  pairId: number;
  /** Giá trị (emoji hoặc URL ảnh) — dùng để so khớp cp định danh. */
  value: string;
  /** Loại nội dung — frontend dùng để render. */
  type: 'emoji' | 'image';
  flipped: boolean;
  matched: boolean;
}

export interface CardFlipSession {
  sessionId: string;
  playerA: string;
  playerB: string;
  playerAData?: { name: string; avatar?: string };
  playerBData?: { name: string; avatar?: string };
  cards: CardFlipCard[];
  currentTurn: string; // userId hoặc 'AI'
  scores: { playerA: number; playerB: number };
  status: GameSessionStatus;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  /** Tên hiển thị của AI (lấy từ BotProfile pool) */
  aiName?: string;
  /** Avatar của AI (lấy từ BotProfile pool) */
  aiAvatar?: string;
  config: CardFlipConfig;
  /** Chế độ chơi được chọn cho trận này. Session cũ thiếu field → coi như 'basic'. */
  mode: CardFlipMode;
  startedAt: Date;
  endedAt?: Date;
  // ---- Đồng hồ chế độ Cơ bản (basic) ----
  /** Mốc kết thúc trận (epoch ms) = startedAt + basicTotalTime. Chỉ dùng cho mode 'basic'. */
  deadlineAt?: number;
  // ---- Đồng hồ cờ vua chế độ Nâng cao (advanced) ----
  /** Quỹ thời gian còn lại của playerA (ms). Chỉ dùng cho mode 'advanced'. */
  timeRemainingA?: number;
  /** Quỹ thời gian còn lại của playerB (ms). Chỉ dùng cho mode 'advanced'. */
  timeRemainingB?: number;
  /**
   * Mốc (epoch ms) bắt đầu tính giờ cho lượt hiện tại — dùng để trừ realtime quỹ giờ
   * của người đang giữ lượt. Chỉ dùng cho mode 'advanced'.
   */
  turnStartedAt?: number;
  /** 2 thẻ đang được lật trong lượt hiện tại (max 2) */
  lastFlipped: number[];
  /** Số cặp ghép liên tiếp đúng hiện tại của playerA */
  consecutivePairsA: number;
  /** Số cặp ghép liên tiếp đúng hiện tại của playerB */
  consecutivePairsB: number;
  /** Số cặp ghép liên tiếp tốt nhất của playerA (để gửi Kafka) */
  maxConsecutivePairsA: number;
  /** Số cặp ghép liên tiếp tốt nhất của playerB (để gửi Kafka) */
  maxConsecutivePairsB: number;
}

export interface CardFlipFlipRequest {
  sessionId: string;
  cardId: number;
}

export interface CardFlipResult {
  sessionId: string;
  winner: string;
  loser: string;
  isAI: boolean;
  score: number;
  playerAScore: number;
  playerBScore: number;
}

export interface GomokuConfig {
  /** Thời gian tối đa ghép trận PvP (giây) */
  matchmakingTimeout: number;
  /**
   * Chế độ ghép đối thủ: `mixed` (tìm người thật rồi mới bot) hoặc `bot_only` (chỉ bot).
   */
  opponentMode: OpponentMode;
  /**
   * Mốc (giây, tính từ lúc bắt đầu tìm) phân chia giai đoạn tìm người thật và giai đoạn ghép bot.
   * Chỉ áp dụng khi `opponentMode = 'mixed'`. Mặc định ≈ 50% của `matchmakingTimeout`.
   * 0 → botActivationSeconds: chỉ tìm người thật. Sau đó bot được ghép tại một thời điểm
   * ngẫu nhiên trong khoảng [botActivationSeconds, matchmakingTimeout].
   */
  botActivationSeconds: number;
  /** Điểm thưởng khi thắng */
  winPoints: number;
  /** Kích thước bàn cờ */
  boardSize: number;
  /** Thời gian tối đa cho một lượt (giây). Hết thời gian → forfeit. */
  turnTimeout: number;
  /** Thời gian tối đa cho toàn bộ trận đấu (giây). Hết giờ → hòa. */
  maxGameDuration: number;
}

export type CellValue = 'X' | 'O' | null;
export type Board = CellValue[][];

export interface GomokuSession {
  sessionId: string;
  playerX: string; // userId
  playerO: string; // userId (có thể là 'AI')
  playerXData?: { name: string; avatar?: string };
  playerOData?: { name: string; avatar?: string };
  board: Board;
  currentTurn: 'X' | 'O';
  status: GameSessionStatus;
  winner?: string;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  /** Tên hiển thị của AI (lấy từ BotProfile pool) */
  aiName?: string;
  /** Avatar của AI (lấy từ BotProfile pool) */
  aiAvatar?: string;
  config: GomokuConfig;
  startedAt: Date;
  endedAt?: Date;
  /** Tổng số nước đã đi (nhẹ hơn moveHistory[]) */
  moveCount: number;
  /** Nước đi cuối cùng */
  lastMove?: GomokuMove;
  /** Nước đi quyết định chiến thắng (chỉ set khi game kết thúc có winner) */
  winningMove?: GomokuMove;
}

export interface GomokuMove {
  player: string; // userId hoặc 'AI'
  symbol: 'X' | 'O';
  row: number;
  col: number;
  timestamp: Date;
}

export interface GomokuMoveRequest {
  sessionId: string;
  row: number;
  col: number;
}

export interface GomokuResult {
  sessionId: string;
  winner: string; // userId hoặc 'AI'
  loser: string;
  isAI: boolean;
  score: number;
  moves: number;
}
