// ============================================================
// Boss Battle (Săn Boss) Types
// Theo SanBoss_Solution_Doc.md
// ============================================================

// ---- Config (DM-01 BossConfig / CFG-01..CFG-08) ----

/** Một mốc trạng thái Boss theo % HP còn lại */
export interface BossStateImage {
  /** % HP tối thiểu (inclusive). VD: 71 nghĩa là >=71% */
  minPercent: number;
  /** % HP tối đa (inclusive). VD: 100 */
  maxPercent: number;
  /** Đường dẫn / mã định danh ảnh */
  img: string;
}

/** Cấu hình Boss Battle (CMS) — áp cho toàn bộ tuần × khối (snapshot vào BossInstance) */
export interface BossBattleConfig {
  /** CFG-01 — Tổng HP Boss (default 50000) */
  hpMax: number;
  /** CFG-02 — Số câu hỏi mỗi ngày (default 5) */
  questionsPerDay: number;
  /** CFG-02b — Tổng số câu mỗi tuần (default 35). Mẫu số "x/N câu" trên My Rank Card. */
  questionsPerWeek: number;
  /** CFG-03 — Điểm cơ bản mỗi câu đúng (default 10) */
  basePoint: number;
  /** CFG-04 — Điểm thưởng tốc độ tối đa (default 5) */
  maxSpeedBonus: number;
  /** CFG-05 — Thời gian tối đa cho mỗi câu (giây, default 60) */
  tMaxSec: number;
  /** CFG-07 — Tên Boss tuần (default "Hắc Long Tri Thức") */
  bossName: string;
  /** CFG-08 — Danh sách mốc %HP → ảnh trạng thái Boss */
  bossStates: BossStateImage[];
  /**
   * URL khung avatar "Dũng sĩ diệt Boss" cấp cho Top 10 cuối tuần (UI-502).
   * CMS quản lý, backend chỉ lưu giá trị và expose qua REST.
   */
  weeklyFrameImageUrl: string;
}

/** Các field của BossBattleConfig có thể override theo (weekKey, gradeLevel) */
export type OverridableBossBattleConfigKey =
  | 'hpMax'
  | 'questionsPerDay'
  | 'questionsPerWeek'
  | 'basePoint'
  | 'maxSpeedBonus'
  | 'tMaxSec'
  | 'bossName'
  | 'bossStates';

/** Phần config override theo (tuần × khối). Chỉ chứa field admin chủ động ghi đè. */
export type BossBattleConfigOverride = Partial<Pick<BossBattleConfig, OverridableBossBattleConfigKey>>;

/** Cấu hình tuần × khối — kèm effective config đã merge với template global */
export interface BossWeeklyConfig {
  id?: string;
  weekKey: string;
  gradeLevel: number;
  /** Các field admin đã override */
  overrides: BossBattleConfigOverride;
  /** Config thực tế sẽ áp dụng = merge(global, overrides). Backend tính sẵn cho CMS. */
  effectiveConfig: BossBattleConfig;
  /** Tuần × khối này đã có BossInstance đang chạy chưa */
  hasInstance: boolean;
  /** Tuần đã đến mốc bắt đầu chạy chưa (now >= Monday 00:00 UTC của weekKey) */
  weekStarted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** PUT /api/admin/boss-battle/weekly-config/:weekKey/:gradeLevel */
export interface UpsertBossWeeklyConfigRequest {
  overrides: BossBattleConfigOverride;
}

/** POST /api/admin/boss-battle/weekly-config/copy */
export interface CopyBossWeeklyConfigRequest {
  sourceWeekKey: string;
  targetWeekKey: string;
  /** Nếu rỗng → copy mọi khối có override ở tuần nguồn */
  grades?: number[];
  /** Ghi đè override đã có ở tuần đích (default false) */
  overwrite?: boolean;
}

// ---- Boss Instance (DM-02) ----

export type BossInstanceStatus = 'ACTIVE' | 'DEFEATED' | 'CLOSED';

/** Phiên Boss đang chạy cho một (tuần × khối) */
export interface BossInstance {
  id: string;
  /** Định danh tuần (ISO week, vd "2026-W23") */
  weekKey: string;
  /** Khối lớp áp dụng */
  gradeLevel: number;
  /** Snapshot config tại thời điểm tạo */
  config: BossBattleConfig;
  /** Tổng điểm mọi HS đã đóng góp */
  totalPointsEarned: number;
  /** = min(100, totalPointsEarned / hpMax * 100) — cache */
  progressPercent: number;
  /** Ảnh trạng thái hiện tại (suy ra từ %HP còn lại) — cache */
  currentBossStateImg: string;
  status: BossInstanceStatus;
  createdAt: Date;
  defeatedAt?: Date | null;
  closedAt?: Date | null;
}

// ---- Student Weekly Progress (DM-03) ----

/** Tiến độ cá nhân theo tuần — nguồn dữ liệu xếp hạng */
export interface StudentBossProgress {
  id: string;
  studentId: string;
  bossInstanceId: string;
  weekKey: string;
  gradeLevel: number;
  /** Tổng câu đúng tuần (tối đa = questionsPerWeek). Tiêu chí xếp hạng #1 */
  correctCountWeek: number;
  /** Tổng thời gian các câu **đúng** (giây). Tiêu chí #2 (nhỏ hơn = trên) */
  totalCorrectTimeSec: number;
  /** Thời điểm đạt mốc thành tích hiện tại. Tiêu chí #3 (sớm hơn = trên) */
  lastAchievedAt: Date | null;
  /** Tổng điểm cá nhân góp vào Boss */
  pointsContributedWeek: number;
}

// ---- Daily Attempt (DM-04) ----

export type DailyAttemptStatus = 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';

/** Lượt làm bài theo ngày của một HS */
export interface DailyAttempt {
  id: string;
  studentId: string;
  bossInstanceId: string;
  /** Ngày làm bài theo timezone hệ thống, dạng "YYYY-MM-DD" */
  dateKey: string;
  /** dayIndex trong tuần (1-7) */
  dayIndex: number;
  questionSetId: string;
  status: DailyAttemptStatus;
  /** Số câu đúng trong lượt */
  correctCount: number;
  /** Tổng thời gian lượt (giây) */
  totalResponseTime: number;
  /** Điểm lượt (gồm speed bonus) */
  pointsEarned: number;
  /** Index câu hiện tại (0-based) */
  currentQuestionIndex: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ---- Question Set (DM-05) ----

export interface BossQuestionSet {
  id: string;
  weekKey: string;
  gradeLevel: number;
  /** Ngày trong tuần (1-7) */
  dayIndex: number;
  /** Danh sách câu hỏi (đúng questionsPerDay câu) */
  questionIds: string[];
}

// ---- Boss Question (DM-06) ----

/** Câu hỏi trong kho Boss — version đầy đủ (có correctIndex, chỉ dùng ở backend) */
export interface BossQuestion {
  id: string;
  /** Khối lớp (6-12) */
  grade: number;
  /** Nội dung câu hỏi */
  content: string;
  /** URL ảnh kèm câu (optional) */
  imageUrl?: string;
  /** 4 lựa chọn */
  options: [string, string, string, string];
  /** Index đáp án đúng (0-3) — KHÔNG gửi ra client */
  correctIndex: number;
  /** Câu hỏi có còn dùng không (CMS có thể disable) */
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Phiên bản câu hỏi gửi cho client — không có correctIndex */
export interface BossQuestionPublic {
  id: string;
  grade: number;
  content: string;
  imageUrl?: string;
  options: [string, string, string, string];
  /** Index câu trong lượt (0-based) */
  questionIndex: number;
  /** Tổng số câu trong lượt */
  totalQuestions: number;
  /** tMaxSec từ config — tránh phải đọc config riêng ở client */
  tMaxSec: number;
}

// ---- Answer Record (DM-07) ----

export interface BossAnswerRecord {
  id: string;
  dailyAttemptId: string;
  questionId: string;
  /** Index đáp án HS chọn (0-3) hoặc null nếu hết giờ */
  selectedIndex: number | null;
  isCorrect: boolean;
  /** Thời gian phản hồi (giây) — server tính từ currentQuestionStartedAt */
  responseTimeSec: number;
  /** Điểm câu này (basePoint + speed bonus) */
  pointsAwarded: number;
  answeredAt: Date;
}

// ---- Leaderboard Entry (DM-08) ----

export interface BossLeaderboardEntry {
  rank: number;
  studentId: string;
  /** Tên hiển thị (lấy từ UserModel) */
  displayName: string;
  /** Avatar URL */
  avatar: string;
  correctCountWeek: number;
  totalCorrectTimeSec: number;
  lastAchievedAt: Date | null;
  pointsContributedWeek: number;
}

export interface BossLeaderboardResponse {
  weekKey: string;
  gradeLevel: number;
  /** Tổng số câu của tuần — dùng làm mẫu số "x/N câu" trên UI */
  questionsPerWeek: number;
  /** Top N entries (default toàn bộ hoặc cấu hình) */
  entries: BossLeaderboardEntry[];
  /** Entry của HS đang request (null nếu chưa làm câu nào) */
  myEntry: BossLeaderboardEntry | null;
}

// ---- Weekly Honor (DM-09) ----

export interface WeeklyHonor {
  id: string;
  weekKey: string;
  gradeLevel: number;
  studentId: string;
  displayName: string;
  avatar?: string;
  /** Hạng cuối tuần (1-10) */
  rank: number;
  correctCountWeek: number;
  totalCorrectTimeSec: number;
  /** Đã cấp khung avatar chưa */
  frameGranted: boolean;
  /** Hết hạn khung (cấp + 7 ngày) */
  frameExpiry: Date;
  /** Đang hiển thị banner trang chủ */
  bannerActive: boolean;
  createdAt: Date;
}

// ---- REST / DTOs ----

/** GET /api/game/boss-battle/lobby?grade=X — FLW-03 */
export interface BossLobbyResponse {
  /** Có Boss tuần hay không (false = chưa init tuần) */
  hasBoss: boolean;
  boss: BossInstance | null;
  /** Số câu HS đã làm trong ngày */
  dailyAnswered: number;
  /** Số câu còn lại trong ngày */
  dailyRemaining: number;
  /** Trạng thái lượt của HS hôm nay */
  dailyStatus: DailyAttemptStatus | null;
  /** Mốc reset tuần kế tiếp (ISO string) — UI-104 countdown */
  weeklyResetAt: string;
  /** Tiến độ cá nhân tuần hiện tại (để hiển thị nhanh) */
  myProgress: StudentBossProgress | null;
}

/** POST /api/game/boss-battle/battle/start — FLW-04 */
export interface BossBattleStartResponse {
  attemptId: string;
  questions: BossQuestionPublic[];
  /** Timestamp server bắt đầu phát câu đầu tiên (ms) — client dùng đồng bộ timer */
  serverStartedAt: number;
}

/** POST /api/game/boss-battle/battle/answer — FLW-05 */
export interface BossAnswerPayload {
  attemptId: string;
  questionId: string;
  /** null nếu hết giờ / bỏ qua */
  selectedIndex: number | null;
}

export interface BossAnswerResponse {
  isCorrect: boolean;
  /** Đáp án đúng (chỉ trả về sau khi đã submit) */
  correctIndex: number;
  /** Thời gian phản hồi server tính được (giây) */
  responseTimeSec: number;
  pointsAwarded: number;
  /** Câu tiếp theo (nếu còn) */
  nextQuestionIndex: number | null;
  /** Đã hoàn thành lượt chưa */
  attemptCompleted: boolean;
}

/** GET /api/game/boss-battle/attempt/:id/result — FLW-06 */
export interface BossDailyResultResponse {
  attempt: DailyAttempt;
  /** Tiến độ Boss sau khi cộng dồn lượt này */
  boss: BossInstance;
  /** Tiến độ cá nhân tuần */
  myProgress: StudentBossProgress;
}

// ---- Admin DTOs ----

export interface BossInstanceMonitorEntry {
  instance: BossInstance;
  /** Số HS đã tham gia trong tuần */
  participantCount: number;
  /** Tổng số lượt ngày đã hoàn thành */
  completedAttemptCount: number;
}

export interface AutoGenerateQuestionSetsRequest {
  weekKey: string;
  gradeLevel: number;
  /** Force regenerate kể cả khi đã có set (default false) */
  force?: boolean;
}

export interface SwapQuestionRequest {
  oldQuestionId: string;
  newQuestionId: string;
}

export interface InitWeekRequest {
  weekKey: string;
  /** Nếu rỗng → init cho mọi khối có config (mặc định 6..12) */
  grades?: number[];
}

export interface InitWeekResponse {
  weekKey: string;
  /** Kết quả init theo từng khối */
  results: Array<{
    gradeLevel: number;
    bossInstanceId: string;
    /** Số question set đã tạo (0 = đã tồn tại trước đó) */
    questionSetsCreated: number;
    /** Lỗi (nếu có) */
    error?: string;
  }>;
}

export interface CloseWeekRequest {
  weekKey: string;
  /** Top N để vinh danh (default = BOSS_BATTLE_LEADERBOARD_HONOR_TOP_N) */
  topN?: number;
}

export interface CloseWeekResponse {
  weekKey: string;
  results: Array<{
    gradeLevel: number;
    honorsCreated: number;
    error?: string;
  }>;
}

// ---- BossQuestion CRUD (CMS) ----

/** Input tạo BossQuestion mới */
export interface CreateBossQuestionInput {
  grade: number;
  content: string;
  imageUrl?: string;
  options: [string, string, string, string];
  correctIndex: number;
  isActive?: boolean;
}

/** Input cập nhật BossQuestion (PATCH-style) */
export type UpdateBossQuestionInput = Partial<CreateBossQuestionInput>;

/** Input upsert BossQuestion (có id thì update; không có id thì create) */
export interface BulkUpsertBossQuestionInput extends CreateBossQuestionInput {
  id?: string;
}

/** Response danh sách câu hỏi Boss */
export interface BossQuestionListResponse {
  success: boolean;
  items: BossQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

/** Response tạo bulk câu hỏi Boss */
export interface BossQuestionBulkCreateResponse {
  success: boolean;
  insertedCount: number;
  errors: Array<{ index: number; error: string }>;
}

/** Response upsert bulk câu hỏi Boss */
export interface BossQuestionBulkUpsertResponse {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  errors: Array<{ index: number; error: string }>;
}
