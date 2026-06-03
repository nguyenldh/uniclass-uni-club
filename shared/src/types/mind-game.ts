// ============================================================
// Mind Game Types — Đấu trí (Gomoku & Card Flip)
// ============================================================

import type { GameSessionStatus, AIDifficulty } from './common';

/** Các game trong nhóm Mind Game */
export type MindGameType = 'gomoku' | 'card_flip';

// ---- Card Flip (Lật thẻ PvP) ----

/** Một item dùng làm mặt trước của thẻ (emoji hoặc link ảnh). */
export interface CardFlipItem {
  type: 'emoji' | 'image';
  /** Nếu type='emoji': ký tự emoji. Nếu type='image': URL ảnh. */
  value: string;
}

export interface CardFlipConfig {
  /** Thời gian tối đa ghép trận PvP (giây) */
  matchmakingTimeout: number;
  /** Điểm thưởng khi thắng */
  winPoints: number;
  /** Số cặp thẻ */
  pairCount: number;
  /** Danh sách item hình nền mặt trước thẻ. Nếu rỗng/undefined → dùng CARD_EMOJIS mặc định. */
  cardItems?: CardFlipItem[];
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
  startedAt: Date;
  endedAt?: Date;
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
  /** Điểm thưởng khi thắng */
  winPoints: number;
  /** Kích thước bàn cờ */
  boardSize: number;
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
