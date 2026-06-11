// ============================================================
// Weekly Event Constants — Sự kiện tuần
// Theo weekly-event-solution.md
// ============================================================

import type { WeeklyEventGeneralConfig } from '../types/weekly-event';

// ---- Redis Key Patterns (DATA-R-001 → DATA-R-010) ----

export const WEEKLY_EVENT_REDIS_KEYS = {
  /** Active Session Cache: we:{eventId}:session:{studentId} — Hash */
  SESSION: (eventId: string) => `we:{${eventId}}:session`,
  /** Real-time Leaderboard: we:{eventId}:lb:{grade} — Sorted Set */
  LEADERBOARD: (eventId: string) => `we:{${eventId}}:lb`,
  /** Online Participants: we:{eventId}:online:{grade} — Set */
  ONLINE: (eventId: string) => `we:{${eventId}}:online`,
  /** Answer Staging Buffer: we:{eventId}:answers:{studentId} — Hash */
  ANSWERS: (eventId: string) => `we:{${eventId}}:answers`,
  /** Room State Machine: we:{eventId}:roomstate:{grade} — Hash */
  ROOM_STATE: (eventId: string) => `we:{${eventId}}:roomstate`,
  /** Distributed Lock (State Transition): we:{eventId}:lock:transition:{grade} */
  LOCK_TRANSITION: (eventId: string) => `we:{${eventId}}:lock:transition`,
  /** Submit Rate Limiter: we:{eventId}:rl:submit:{studentId} */
  RL_SUBMIT: (eventId: string) => `we:{${eventId}}:rl:submit`,
  /** Auto-submit Worker Queue: we:{eventId}:autosubmit:queue — List */
  AUTOSUBMIT_QUEUE: (eventId: string) => `we:{${eventId}}:autosubmit:queue`,
  /** Socket Session Mapping: we:{eventId}:socket:{studentId} — Hash */
  SOCKET_MAPPING: (eventId: string) => `we:{${eventId}}:socket`,
  /** Socket Reverse Mapping: we:{eventId}:socket-reverse:{socketId} — String */
  SOCKET_REVERSE: (eventId: string) => `we:{${eventId}}:socket-reverse`,
  /** Shuffled questions cache: we:{eventId}:shuffled:{studentId} — String (JSON) */
  SHUFFLED: (eventId: string) => `we:{${eventId}}:shuffled`,
  /** Students who joined the event: we:{eventId}:joined:{grade} — Set */
  JOINED: (eventId: string) => `we:{${eventId}}:joined`,
  /** Students who submitted: we:{eventId}:submitted:{grade} — Set */
  SUBMITTED: (eventId: string) => `we:{${eventId}}:submitted`,
  /** Disconnect count per student: we:{eventId}:disconnect:{studentId} — String */
  DISCONNECT_COUNT: (eventId: string) => `we:{${eventId}}:disconnect`,
  /** Personal result cache: we:{eventId}:personal-result:{studentId} — String (JSON) */
  PERSONAL_RESULT: (eventId: string) => `we:{${eventId}}:personal-result`,
  /** General config cache */
  GENERAL_CONFIG: 'we:general-config',
  /** Event cache: we:event:{eventId} */
  EVENT: 'we:event',
  /** Exam cache: we:exam:{examId} */
  EXAM: 'we:exam',
  /** Scheduler lock: we:lock:scheduler */
  LOCK_SCHEDULER: 'we:lock:scheduler',
  /** Auto-generate lock: we:lock:autogen */
  LOCK_AUTOGEN: 'we:lock:autogen',
} as const;

// ---- Socket.IO Namespaces ----

export const WEEKLY_EVENT_NAMESPACES = {
  /** Namespace cho học sinh */
  STUDENT: '/we',
  /** Namespace cho CMS monitoring */
  ADMIN: '/we-admin',
} as const;

// ---- Socket.IO Room Prefixes ----

export const WEEKLY_EVENT_ROOM_PREFIX = 'room';
export const WEEKLY_EVENT_STUDENT_ROOM_PREFIX = 'student';
export const WEEKLY_EVENT_ADMIN_ROOM_PREFIX = 'admin';

// ---- Socket Events: Server → Client ----

export const WEEKLY_EVENT_SOCKET_EVENTS = {
  /** S01: Broadcast state machine transition */
  ROOM_STATE: 'room:state',
  /** S02: Push online count khi có join/leave */
  ROOM_ONLINE_COUNT: 'room:online-count',
  /** S03: Broadcast đề thi khi bắt đầu */
  EXAM_START: 'exam:start',
  /** S04: Emit riêng khi reconnect — khôi phục bài làm */
  SESSION_RESUME: 'session:resume',
  /** S05: Ack cho mỗi answer submit */
  ANSWER_ACK: 'answer:ack',
  /** S06: Broadcast leaderboard snapshot */
  ROOM_LEADERBOARD: 'room:leaderboard',
  /** S07: Emit riêng kết quả cá nhân */
  PERSONAL_RESULT: 'personal:result',
  /** S08: Broadcast khi operator hủy sự kiện */
  ROOM_CANCELLED: 'room:cancelled',
  /** S09: Time sync response */
  SERVER_TIME: 'server:time',
  /** S10: Error chuẩn hóa */
  SYSTEM_ERROR: 'system:error',
  /** S11: Session bị terminate (multi-tab) */
  SESSION_TERMINATED: 'session:terminated',
} as const;

// ---- Socket Events: Client → Server ----

export const WEEKLY_EVENT_CLIENT_EVENTS = {
  /** C01: Chính thức join room sau handshake */
  ROOM_JOIN: 'room:join',
  /** C02: Submit 1 đáp án */
  ANSWER_SUBMIT: 'answer:submit',
  /** C03: Yêu cầu resume state khi reconnect */
  SESSION_REQUEST_RESUME: 'session:request-resume',
  /** C04: Time sync request */
  TIME_SYNC: 'time:sync',
  /** C05: Nộp bài sớm */
  EXAM_SUBMIT_FINAL: 'exam:submit-final',
} as const;

// ---- Socket Events: Admin Namespace ----

export const WEEKLY_EVENT_ADMIN_SOCKET_EVENTS = {
  /** A01: Server → Client — metrics mỗi grade */
  MONITOR_METRICS: 'monitor:metrics',
  /** A02: Server → Client — alert */
  MONITOR_ALERT: 'monitor:alert',
  /** A03: Client → Server — subscribe vào event */
  MONITOR_SUBSCRIBE: 'monitor:subscribe',
  /** A04: Client → Server — cancel event */
  EVENT_CANCEL: 'event:cancel',
} as const;

// ---- Default Config ----

export const DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG: WeeklyEventGeneralConfig = {
  defaultWaitingDuration: 5,
  defaultExamDuration: 20,
  defaultLeaderboardDuration: 5,
  leaderboardLimit: 10,
  defaultActiveGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  timezone: 'Asia/Ho_Chi_Minh',
};

// ---- Other Constants ----

/** Số câu hỏi mặc định mỗi đề */
export const WEEKLY_EVENT_DEFAULT_QUESTION_COUNT = 25;

/** Số khối lớp tối đa */
export const WEEKLY_EVENT_MAX_GRADES = 12;

/**
 * Thời gian chấm bài TỐI ĐA (phút) — chỉ là fallback an toàn.
 * Bình thường room chuyển Grading → Showing ngay khi chấm xong;
 * deadline này chỉ kích hoạt nếu instance chấm bài bị crash giữa chừng.
 */
export const WEEKLY_EVENT_MAX_GRADING_MINUTES = 10;

/** TTL mặc định cho Redis keys (event end + 1h buffer, tính bằng giây) */
export const WEEKLY_EVENT_REDIS_TTL_BUFFER = 3600;

/** TTL mặc định cho Redis keys khi không có event object (2h, tính bằng giây) */
export const WEEKLY_EVENT_DEFAULT_KEY_TTL = 7200;

/** Thời gian socket token hợp lệ (giây) */
export const WEEKLY_EVENT_SOCKET_TOKEN_TTL = 60;

/** Thời gian lock scheduler (giây) */
export const WEEKLY_EVENT_SCHEDULER_LOCK_TTL = 30;

/** Thời gian lock transition (giây) */
export const WEEKLY_EVENT_TRANSITION_LOCK_TTL = 30;

/** Thời gian lock auto-generate (giây) */
export const WEEKLY_EVENT_AUTOGEN_LOCK_TTL = 120;

/** Submit rate limit: tối đa N submit/giây/học sinh */
export const WEEKLY_EVENT_SUBMIT_RATE_LIMIT = 5;

/** Throttle online count broadcast (ms) */
export const WEEKLY_EVENT_ONLINE_COUNT_THROTTLE_MS = 500;

/** Interval time sync (ms) */
export const WEEKLY_EVENT_TIME_SYNC_INTERVAL_MS = 10000;

/** Interval admin metrics push (ms) */
export const WEEKLY_EVENT_ADMIN_METRICS_INTERVAL_MS = 2000;

/** Cache TTL cho general config (giây) */
export const WEEKLY_EVENT_CONFIG_CACHE_TTL = 300;

/** Cache TTL cho event (giây) */
export const WEEKLY_EVENT_EVENT_CACHE_TTL = 60;

/** Cache TTL cho exam (giây) */
export const WEEKLY_EVENT_EXAM_CACHE_TTL = 300;

/** Số worker tối đa cho auto-submit queue */
export const WEEKLY_EVENT_AUTOSUBMIT_MAX_WORKERS = 10;

/** Số lần reconnect tối đa trước khi hiển thị fullscreen error */
export const WEEKLY_EVENT_MAX_RECONNECT_ATTEMPTS = 5;
