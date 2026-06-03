// ============================================================
// Quiz Arena Types — So Tài
// ============================================================

import type { GameSessionStatus, AIDifficulty, AuthUser } from './common';

/** Nhóm năng lực / độ khó được tính tự động */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

// ---- Config ----

export interface QuizArenaConfig {
  /** Số câu hỏi mỗi trận (default: 10) */
  questionsPerMatch: number;
  /** Điểm tối đa trên một câu (default: 1000) */
  maxPointsPerQuestion: number;
  /**
   * Hệ số bảo toàn điểm tối thiểu (default: 0.5).
   * Trả lời đúng ở giây cuối vẫn nhận tối thiểu `minScoreRetention * maxPointsPerQuestion`.
   */
  minScoreRetention: number;
  /** Điểm UniPoint đồng bộ về UniClass mỗi câu đúng (default: 10) */
  uniPointsPerCorrect: number;
  /** Tổng thời gian tìm trận tối đa (giây, default: 30) */
  matchmakingTimeout: number;
  /**
   * @deprecated Sử dụng botActivationSeconds thay thế.
   * Giữ lại để backward compatible. Backend không còn dùng field này.
   */
  realPlayerSearchSeconds: number;
  /**
   * Thời điểm tính từ lúc bắt đầu tìm trận mà hệ thống ghép bot (giây, default: 15).
   * VD: botActivationSeconds = 15 → 0-15s chỉ tìm người thật, sau 15s cho phép ghép bot.
   */
  botActivationSeconds: number;
  /**
   * Ngưỡng tỷ lệ đúng câu hỏi để phân loại Dễ (mặc định: 0.75).
   * Câu có correctRate >= threshold này → bucket 'easy' (nhiều người đúng = câu dễ).
   */
  easyQuestionThreshold: number;
  /**
   * Ngưỡng tỷ lệ đúng câu hỏi để phân loại Khó (mặc định: 0.40).
   * Câu có correctRate <= threshold này → bucket 'hard' (ít người đúng = câu khó).
   */
  hardQuestionThreshold: number;
  /**
   * Ngưỡng tỷ lệ đúng tích lũy để xếp học sinh vào nhóm Yếu (mặc định: 0.45).
   * Học sinh có correctRate < threshold → nhóm 'easy' bucket (chơi với câu dễ).
   */
  easyPlayerThreshold: number;
  /**
   * Ngưỡng tỷ lệ đúng tích lũy để xếp học sinh vào nhóm Giỏi (mặc định: 0.75).
   * Học sinh có correctRate >= threshold → nhóm 'hard' bucket (chơi với câu khó).
   */
  hardPlayerThreshold: number;
  /**
   * Số trận gần nhất dùng để tính phong độ học sinh (default: 5).
   * Set 0 để dùng toàn bộ lịch sử.
   */
  recentMatchesForAbility: number;
  /**
   * Số câu liên tiếp không trả lời để bị xử thua do AFK (default: 3).
   */
  afkConsecutiveMisses: number;
  /**
   * Độ trễ (ms) trước khi chuyển sang câu hỏi tiếp theo sau khi cả 2 đã trả lời (default: 3000).
   */
  nextQuestionDelayMs: number;
}

// ---- Question ----

/** Câu hỏi lưu trong DB — có correctIndex (private) */
export interface QuizQuestion {
  id: string;
  /** Khối lớp (6, 7, 8, 9, 10, 11, 12, ...) */
  grade: number;
  /** Nội dung câu hỏi */
  content: string;
  /** 4 lựa chọn đáp án */
  options: [string, string, string, string];
  /** Index đáp án đúng (0-3) */
  correctIndex: number;
  /** Thời gian trả lời tối đa của câu này (giây) */
  timeLimitSeconds: number;
  /** Bucket độ khó được tính tự động (null = chưa đủ dữ liệu) */
  difficultyBucket: QuizDifficulty | null;
  /** Tổng số lượt làm bài */
  totalAttempts: number;
  /** Tổng số lượt trả lời đúng */
  totalCorrect: number;
  /** Tỷ lệ đúng = totalCorrect / totalAttempts, null nếu chưa có dữ liệu */
  correctRate: number | null;
}

/** Phiên bản câu hỏi gửi cho client — không có correctIndex */
export interface QuizQuestionPublic {
  id: string;
  grade: number;
  content: string;
  options: [string, string, string, string];
  timeLimitSeconds: number;
  /** Index câu trong trận (0-9) */
  questionIndex: number;
  /** Tổng số câu trong trận */
  totalQuestions: number;
  /** Timestamp (ms) khi server bắt đầu phát câu hỏi — dùng để tính thời gian còn lại khi reconnect */
  startedAt: number;
}

// ---- Per-player in-match state ----

export interface QuizPlayerAnswer {
  questionId: string;
  /** null nếu không trả lời (hết giờ hoặc bỏ qua) */
  selectedIndex: number | null;
  /** Thời gian phản xạ (ms) tính từ lúc backend phát câu — null nếu không trả lời */
  responseTimeMs: number | null;
  isCorrect: boolean;
  earnedPoints: number;
}

export interface QuizPlayerState {
  userId: string;
  /** Tên hiển thị (nickname) */
  displayName: string;
  /** URL avatar (optional - dùng cho cả bot và player) */
  avatar?: string;
  /** Khối lớp */
  grade: number;
  /** Tổng điểm tích lũy */
  totalScore: number;
  /** Số câu trả lời đúng */
  correctCount: number;
  /** Tổng thời gian phản xạ của các câu đúng (ms) — dùng tie-breaker */
  totalCorrectTimeMs: number;
  /** Lịch sử đáp án từng câu */
  answers: QuizPlayerAnswer[];
  /** Số câu liên tiếp không trả lời */
  consecutiveMisses: number;
  /** Đã mất kết nối */
  disconnected: boolean;
  /** Timestamp gửi câu trả lời cuối cùng (dùng tie-breaker cuối cùng) */
  finalSubmittedAt: number | null;
  /** Đã gửi đủ tất cả câu hỏi chưa (bao gồm null) */
  finished: boolean;
}

// ---- Session ----

export interface QuizArenaSession {
  sessionId: string;
  playerA: string; // userId
  playerB: string; // userId (có thể là 'BOT')
  playerAData?: AuthUser | null;
  playerBData?: AuthUser | null;
  /** Khối lớp của trận đấu */
  grade: number;
  /** Nhóm năng lực của trận đấu */
  abilityBucket: QuizDifficulty;
  /** Trận đấu với AI bot không */
  isBot: boolean;
  /** Độ khó bot (chỉ khi isBot=true) */
  botDifficulty?: QuizDifficulty;
  /** Profile bot (chỉ khi isBot=true) */
  botProfile?: QuizBotProfile;
  /** Danh sách câu hỏi trong trận (đã xáo trộn và pick) — full object, có correctIndex */
  questions: QuizQuestion[];
  /** Index câu hỏi hiện tại (0-based) */
  currentQuestionIndex: number;
  /** Timestamp (ms) khi backend bắt đầu phát câu hỏi hiện tại */
  currentQuestionStartedAt: number | null;
  /** Handle ID của timeout tự động chuyển câu hỏi (không serialize, chỉ runtime) */
  // questionTimeoutHandle?: NodeJS.Timeout; — KHÔNG lưu vào Redis
  playerAState: QuizPlayerState;
  playerBState: QuizPlayerState;
  status: GameSessionStatus;
  winner: string | null; // userId | 'BOT' | null
  /** Config áp dụng cho trận này (snapshot tại thời điểm tạo) */
  config: QuizArenaConfig;
  startedAt: Date;
  endedAt?: Date;
}

// ---- Bot ----

export interface QuizBotProfile {
  /** Tỷ lệ trả lời đúng của bot (0-1) */
  correctRate: number;
  /** Thời gian phản xạ tối thiểu (ms) */
  minResponseMs: number;
  /** Thời gian phản xạ tối đa (ms) */
  maxResponseMs: number;
}

// ---- Answer submitted by client ----

export interface QuizAnswerPayload {
  sessionId: string;
  /** Index đáp án chọn (0-3), hoặc null nếu hết giờ/bỏ qua */
  selectedIndex: number | null;
}

// ---- Result ----

export interface QuizPlayerSummary {
  userId: string;
  displayName: string;
  totalScore: number;
  correctCount: number;
  totalCorrectTimeMs: number;
  /** Số điểm UniPoint được đồng bộ về UniClass */
  uniPointsEarned: number;
  answers: QuizPlayerAnswer[];
}

export interface QuizArenaResult {
  sessionId: string;
  /** Winner: userId, 'BOT', hoặc (trong trường hợp cực kỳ hiếm) 'DRAW_SYSTEM' — thực tế luôn có winner */
  winner: string;
  loser: string;
  isBot: boolean;
  playerA: QuizPlayerSummary;
  playerB: QuizPlayerSummary;
}

// ============================================================
// Question CRUD (CMS)
// ============================================================

/** Input tạo câu hỏi mới */
export interface CreateQuizQuestionInput {
  grade: number;
  content: string;
  options: [string, string, string, string];
  correctIndex: number;
  timeLimitSeconds: number;
}

/** Input upsert câu hỏi (có id thì update, không có id thì create) */
export interface BulkUpsertQuestionInput extends CreateQuizQuestionInput {
  /** ID câu hỏi đã có (nếu có → update; nếu không có → create mới) */
  id?: string;
}

/** Input cập nhật câu hỏi */
export type UpdateQuizQuestionInput = Partial<CreateQuizQuestionInput>;

/** Response danh sách câu hỏi */
export interface QuizQuestionListResponse {
  success: boolean;
  questions: QuizQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

/** Response tạo bulk câu hỏi */
export interface QuizQuestionBulkCreateResponse {
  success: boolean;
  insertedCount: number;
  errors: Array<{ index: number; error: string }>;
}

/** Response upsert bulk câu hỏi */
export interface QuizQuestionBulkUpsertResponse {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  errors: Array<{ index: number; error: string }>;
}
