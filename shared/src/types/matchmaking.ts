// ============================================================
// Matchmaking Types — game-agnostic, tái sử dụng cho mọi game PvP
// ============================================================

import type { AIDifficulty, MatchmakingStatus } from './common';

/** Tất cả game có hỗ trợ matchmaking PvP */
export type MatchmakingGameType = 'gomoku' | 'quiz' | 'card_flip' | 'quiz_arena';

/** Entry trong matchmaking queue */
export interface MatchmakingEntry {
  userId: string;
  gameType: MatchmakingGameType;
  joinedAt: number; // timestamp
  socketId: string;
  /**
   * Partition key tùy chọn: nếu có, matchmaking chỉ ghép các entry cùng partitionKey.
   * Quiz Arena dùng `${grade}:${abilityBucket}`. Game khác không cần truyền.
   */
  partitionKey?: string;
  /** Dữ liệu context tùy game, không phá backward-compat */
  context?: Record<string, unknown>;
}

/** Kết quả trả về từ matchmaking service */
export interface MatchmakingResult {
  status: MatchmakingStatus;
  gameType: MatchmakingGameType;
  opponentId?: string;
  sessionId?: string;
  isAI?: boolean;
  aiDifficulty?: AIDifficulty;
  /** Vai trò của người chơi hiện tại: 'first' = vào queue trước (playerX trong Gomoku), 'second' = vào sau (playerO) */
  role?: 'first' | 'second';
  /**
   * Thông tin đối thủ (dùng cho cả bot và người thật).
   * Frontend hiển thị profile này thay vì reveal AI.
   */
  opponentProfile?: {
    name: string;
    avatar?: string;
  };
}

/**
 * Factory interface — mỗi game PvP tự implement để đăng ký vào MatchmakingService.
 * MatchmakingService không cần biết chi tiết từng game, chỉ gọi factory.
 */
export interface MatchmakingSessionFactory {
  /** Tạo session PvP giữa 2 người chơi */
  createPVPSession(playerA: string, playerB: string): Promise<{ sessionId: string }>;
  /** Tạo session đấu AI khi timeout. Trả về cả botProfile để hiển thị nhất quán. */
  createAISession(userId: string, difficulty: AIDifficulty): Promise<{
    sessionId: string;
    botProfile?: { name: string; avatar?: string };
  }>;
}
