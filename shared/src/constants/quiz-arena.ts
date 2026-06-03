// ============================================================
// Quiz Arena Constants — So Tài
// ============================================================

import type { QuizArenaConfig, QuizBotProfile, QuizDifficulty } from '../types/quiz-arena';

// ---- Redis keys ----

export const QUIZ_ARENA_REDIS_KEYS = {
  /** Session data: quiz-arena:session:<sessionId> */
  SESSION: 'quiz-arena:session',
  /** Nhóm năng lực của user: quiz-arena:user-ability:<userId> */
  USER_ABILITY: 'quiz-arena:user-ability',
  /**
   * Lịch sử correctness N trận gần nhất: quiz-arena:user-recent-matches:<userId>
   * Mỗi phần tử JSON: { correct: number, total: number }
   */
  USER_RECENT_MATCHES: 'quiz-arena:user-recent-matches',
  /**
   * Danh sách ID câu hỏi user đã làm gần đây: quiz-arena:user-recent-questions:<userId>
   */
  USER_RECENT_QUESTIONS: 'quiz-arena:user-recent-questions',
  /** UniClass sync retry queue (list): quiz-arena:uniclass-sync:retry */
  UNICLASS_SYNC_RETRY: 'quiz-arena:uniclass-sync:retry',
  /** Pending matchmaking context: quiz-arena:pending-context:<userId> */
  PENDING_CONTEXT: 'quiz-arena:pending-context',
} as const;

// ---- Socket events ----

export const QUIZ_ARENA_SOCKET_EVENTS = {
  /** Client → Server: join session room sau khi nhận matched */
  JOIN_SESSION: 'quiz-arena:join-session',
  /**
   * Server → Client: cả 2 player đã join, bắt đầu countdown.
   * Payload: { startsAt: number } — timestamp khi game bắt đầu
   */
  COUNTDOWN: 'quiz-arena:countdown',
  /**
   * Server → Client: phát câu hỏi mới.
   * Payload: QuizQuestionPublic + { questionIndex, totalQuestions, startedAt }
   */
  QUESTION: 'quiz-arena:question',
  /** Client → Server: gửi đáp án */
  ANSWER: 'quiz-arena:answer',
  /**
   * Server → Client: thông báo đối thủ đã trả lời (chỉ flag, không tiết lộ đáp án).
   * Payload: { questionIndex: number }
   */
  OPPONENT_ANSWERED: 'quiz-arena:opponent-answered',
  /**
   * Server → Client: kết quả câu hỏi sau khi cả 2 trả lời hoặc hết giờ.
   * Payload: { questionIndex, correctIndex, playerA: { earned, responseTimeMs }, playerB: ... }
   */
  QUESTION_RESULT: 'quiz-arena:question-result',
  /**
   * Server → Client: trạng thái tổng thể (dự phòng, broadcast sau mỗi câu).
   * Payload: { playerA: QuizPlayerState (không có answers detail), playerB: same }
   */
  STATE: 'quiz-arena:state',
  /**
   * Server → Client: trận đấu kết thúc.
   * Payload: QuizArenaResult
   */
  END: 'quiz-arena:end',
  /** Server → Client: đối thủ mất kết nối */
  OPPONENT_DISCONNECTED: 'quiz-arena:opponent-disconnected',
} as const;

// ---- Default config ----

export const DEFAULT_QUIZ_ARENA_CONFIG: QuizArenaConfig = {
  questionsPerMatch: 10,
  maxPointsPerQuestion: 1000,
  minScoreRetention: 0.5,
  uniPointsPerCorrect: 10,
  matchmakingTimeout: 30,
  realPlayerSearchSeconds: 15,
  botActivationSeconds: 16,
  easyQuestionThreshold: 0.75,
  hardQuestionThreshold: 0.40,
  easyPlayerThreshold: 0.45,
  hardPlayerThreshold: 0.75,
  recentMatchesForAbility: 5,
  afkConsecutiveMisses: 3,
  nextQuestionDelayMs: 3000,
};

// ---- Bot profiles ----

/**
 * Profile bot theo độ khó trận đấu.
 * correctRate: xác suất trả lời đúng.
 * minResponseMs / maxResponseMs: khoảng thời gian phản xạ giả lập.
 */
export const QUIZ_BOT_PROFILES: Record<QuizDifficulty, QuizBotProfile> = {
  easy: {
    correctRate: 0.40,
    minResponseMs: 12000,
    maxResponseMs: 20000,
  },
  medium: {
    correctRate: 0.65,
    minResponseMs: 7000,
    maxResponseMs: 15000,
  },
  hard: {
    correctRate: 0.88,
    minResponseMs: 2000,
    maxResponseMs: 8000,
  },
};

/** Tên hiển thị bot (random từ pool) */
export const QUIZ_BOT_NAMES = [
  'QuizBot Alpha',
  'Bot Siêu Tốc',
  'Học Máy 3000',
  'Neural Ninja',
  'RoboStudent',
  'AI Challenger',
  'DataBot Pro',
  'BrainBot X',
];

/** Giới hạn số câu hỏi lưu lịch sử per user để tránh trùng (default: 50) */
export const QUIZ_USER_RECENT_QUESTIONS_LIMIT = 50;
