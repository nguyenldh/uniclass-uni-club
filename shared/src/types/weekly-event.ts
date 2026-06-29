// ============================================================
// Weekly Event Types — Sự kiện tuần
// Theo weekly-event-solution.md
// ============================================================

import type { AuthUser } from './common';

// ---- Enums ----

/** Trạng thái của một Weekly Event */
export type WeeklyEventStatus =
  | 'Draft'
  | 'Scheduled'
  | 'Waiting'
  | 'InProgress'
  | 'Grading'
  | 'Showing'
  | 'Closed'
  | 'Cancelled';

/** Trạng thái của một phòng thi (theo khối) */
export type WeeklyEventRoomStatus =
  | 'Scheduled'
  | 'Waiting'
  | 'InProgress'
  | 'Grading'
  | 'Showing'
  | 'Closed'
  | 'Cancelled';

/** Loại nộp bài */
export type SubmissionType = 'manual' | 'auto_timeout' | 'auto_disconnect';

// ---- DATA-M-001: WeeklyEventGeneralConfig ----

export interface WeeklyEventGeneralConfig {
  /** Thời gian chờ (phút) — default 5 */
  defaultWaitingDuration: number;
  /** Thời gian làm bài (phút) — default 20 */
  defaultExamDuration: number;
  /** Thời gian hiển thị leaderboard (phút) — default 5 */
  defaultLeaderboardDuration: number;
  /** Số lượng hiển thị trong Top — default 10 */
  leaderboardLimit: number;
  /** Điểm cộng cho mỗi câu trả lời đúng — default 10 */
  pointsPerCorrect: number;
  /** Các khối lớp mặc định được tham gia */
  defaultActiveGrades: number[];
  /** Múi giờ */
  timezone: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ---- DATA-M-002: WeeklyEvent ----

export interface WeeklyEvent {
  _id?: string;
  /** Số tuần trong năm */
  weekNumber: number;
  /** Năm */
  year: number;
  /** Tiêu đề sự kiện */
  title: string;
  /** Thời gian bắt đầu dự kiến (ISO string) */
  scheduledStartAt: string;
  /** Thời gian bắt đầu thực tế */
  actualStartAt?: string | null;
  /** Thời gian kết thúc thực tế */
  actualEndAt?: string | null;
  /** Thời gian chờ (phút) */
  waitingDuration: number;
  /** Thời gian làm bài (phút) */
  examDuration: number;
  /** Thời gian hiển thị leaderboard (phút) */
  leaderboardDuration: number;
  /** Ghi đè số câu hỏi (mặc định 25) */
  questionCountOverride: number;
  /** Các khối lớp được tham gia tuần này */
  activeGrades: number[];
  /** Trạng thái */
  status: WeeklyEventStatus;
  /** Gán đề cho từng khối: map grade (string) → examId */
  examAssignments: Record<string, string>;
  createdAt?: string;
  createdBy?: string;
}

// ---- DATA-M-003: WeeklyEventRoom ----

export interface WeeklyEventRoom {
  _id?: string;
  /** Reference đến WeeklyEvent */
  eventId: string;
  /** Khối lớp */
  grade: number;
  /** Đề thi được gán */
  examId?: string;
  /** Trạng thái phòng */
  status: WeeklyEventRoomStatus;
  /** Lịch sử chuyển trạng thái */
  stateTransitions: StateTransition[];
  /** Số học sinh đã tham gia */
  participantCount: number;
  /** Số bài đã nộp */
  submittedCount: number;
}

export interface StateTransition {
  to: WeeklyEventRoomStatus;
  at: string;
}

// ---- DATA-M-004: ExamBank ----

export interface ExamOption {
  key: string; // "A" | "B" | "C" | "D"
  text: string;
}

export interface ExamQuestion {
  questionId: string;
  /** Nội dung câu hỏi */
  stem: string;
  /** 4 phương án */
  options: ExamOption[];
  /** Đáp án đúng — KHÔNG gửi ra client */
  correctKey: string;
  /** Có cho phép trộn thứ tự phương án không */
  shuffleable: boolean;
}

export interface ExamBank {
  _id?: string;
  /** Khối lớp */
  grade: number;
  /** Tiêu đề đề thi */
  title: string;
  /** Tổng số câu hỏi */
  totalQuestions: number;
  /** Danh sách câu hỏi */
  questions: ExamQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

/** Phiên bản câu hỏi gửi cho client — không có correctKey */
export interface ExamQuestionPublic {
  questionId: string;
  stem: string;
  options: ExamOption[];
  /** Index câu trong bài (0-based) */
  questionIndex: number;
  /** Tổng số câu */
  totalQuestions: number;
}

// ---- DATA-M-005: WeeklyEventParticipation ----

export interface WeeklyEventParticipation {
  _id?: string;
  eventId: string;
  roomId: string;
  studentId: string;
  grade: number;
  joinedAt: string;
  examStartedAt?: string | null;
  submittedAt?: string | null;
  submissionType?: SubmissionType;
  disconnectCount: number;
  /** Seed để trộn câu hỏi riêng cho từng học sinh */
  shuffleSeed: string;
}

// ---- DATA-M-006: WeeklyEventResult ----

export interface WeeklyEventAnswer {
  questionId: string;
  selectedKey: string | null;
  isCorrect: boolean;
  answeredAt: string;
}

export interface WeeklyEventResult {
  _id?: string;
  participationId: string;
  eventId: string;
  roomId: string;
  studentId: string;
  /** Số câu đúng */
  correctCount: number;
  /** Tổng số câu đã trả lời */
  totalAnswered: number;
  /** Tổng thời gian làm bài (ms) */
  totalTimeMs: number;
  /** Thời điểm trả lời đúng câu cuối cùng */
  lastCorrectAnswerAt?: string;
  /** Hạng trong khối */
  rank?: number;
  /** Điểm số */
  score: number;
  /** Chi tiết từng câu */
  answers: WeeklyEventAnswer[];
}

// ---- DATA-M-007: WeeklyEventLeaderboardSnapshot ----

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  displayName: string;
  avatarUrl?: string;
  correctCount: number;
  totalTimeMs: number;
}

export interface WeeklyEventLeaderboardSnapshot {
  _id?: string;
  eventId: string;
  roomId: string;
  grade: number;
  topN: LeaderboardEntry[];
  computedAt: string;
}

// ---- Socket Event Payloads ----

/** SOCK-EVT-S01: room:state */
export interface RoomStatePayload {
  grade: number;
  status: WeeklyEventRoomStatus;
  transitionedAt: string;
  nextTransitionAt?: string;
}

/** SOCK-EVT-S02: room:online-count */
export interface OnlineCountPayload {
  grade: number;
  count: number;
}

/** SOCK-EVT-S03: exam:start */
export interface ExamStartPayload {
  questions: ExamQuestionPublic[];
  examStartedAt: string;
  examEndAt: string;
}

/** SOCK-EVT-S04: session:resume */
export interface SessionResumePayload {
  answers: Record<string, { key: string; at: number }>;
  currentQuestionIdx: number;
  remainingMs: number;
  status: WeeklyEventRoomStatus;
  questions?: ExamQuestionPublic[];
}

/** SOCK-EVT-S05: answer:ack */
export interface AnswerAckPayload {
  questionId: string;
  savedAt: string;
  answeredCount: number;
}

/** SOCK-EVT-S06: room:leaderboard */
export interface LeaderboardPayload {
  topN: LeaderboardEntry[];
  computedAt: string;
}

/** SOCK-EVT-S07: personal:result */
export interface PersonalResultPayload {
  correctCount: number;
  totalAnswered: number;
  rank: number;
  score: number;
  totalTimeMs: number;
}

/** SOCK-EVT-S08: room:cancelled */
export interface RoomCancelledPayload {
  reason: string;
  cancelledAt: string;
}

/** SOCK-EVT-S09: server:time */
export interface TimeSyncPayload {
  serverTime: number;
  clientSentAt: number;
}

/** SOCK-EVT-S10: system:error */
export type WeeklyEventErrorCode =
  | 'EVENT_LATE'
  | 'RATE_LIMITED'
  | 'ALREADY_SUBMITTED'
  | 'INVALID_STATE'
  | 'PENDING_RESULTS';

export interface SystemErrorPayload {
  code: WeeklyEventErrorCode;
  message: string;
  retryable: boolean;
}

/** SOCK-EVT-S11: session:terminated */
export interface SessionTerminatedPayload {
  reason: 'new_login' | 'kicked';
}

// ---- Client → Server Event Payloads ----

/** SOCK-EVT-C02: answer:submit */
export interface AnswerSubmitPayload {
  questionId: string;
  key: string;
}

/** SOCK-EVT-C04: time:sync */
export interface TimeSyncRequestPayload {
  clientTime: number;
}

// ---- Admin Monitoring ----

export interface MonitorMetrics {
  grade: number;
  online: number;
  submitted: number;
  errorRate: number;
}

export interface MonitorAlert {
  level: 'warn' | 'critical';
  code: string;
  message: string;
}

// ---- REST DTOs ----

/** POST /api/game/weekly-event/:eventId/join — response */
export interface JoinEventResponse {
  roomId: string;
  status: WeeklyEventRoomStatus;
  nextTransitionAt?: string;
  socketToken: string;
  socketUrl: string;
}

export interface CurrentEventResponse {
  event: WeeklyEvent | null;
  status: 'before-open' | 'open' | 'in-progress' | 'closed';
  nextEventAt?: string;
  hasJoined?: boolean;
  roomId?: string;
  socketToken?: string;
}

// ---- Admin Request DTOs ----

export interface CreateExamInput {
  grade: number;
  title: string;
  questions: Omit<ExamQuestion, 'questionId'>[];
}

export interface UpdateExamInput {
  grade?: number;
  title?: string;
  questions?: Omit<ExamQuestion, 'questionId'>[];
}

export interface CreateEventInput {
  weekNumber: number;
  year: number;
  title: string;
  scheduledStartAt: string;
  activeGrades?: number[];
}

export interface UpdateEventInput {
  title?: string;
  scheduledStartAt?: string;
  waitingDuration?: number;
  examDuration?: number;
  leaderboardDuration?: number;
  questionCountOverride?: number;
  activeGrades?: number[];
}

export interface AssignExamInput {
  grade: number;
  examId: string;
}

export interface CancelEventInput {
  reason: string;
}

export interface UpdateGeneralConfigInput {
  defaultWaitingDuration?: number;
  defaultExamDuration?: number;
  defaultLeaderboardDuration?: number;
  leaderboardLimit?: number;
  pointsPerCorrect?: number;
  defaultActiveGrades?: number[];
  timezone?: string;
}
