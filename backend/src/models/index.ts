import mongoose, { Schema, Document } from 'mongoose';
import type {
  MindGameType,
  GomokuConfig,
  CardFlipConfig,
  QuizArenaConfig,
  QuizDifficulty,
  BossBattleConfig,
  BossBattleConfigOverride,
  BossStateImage,
  BossInstanceStatus,
  DailyAttemptStatus,
} from '@uniclub/shared';
import { DEFAULT_PROVOKE_EMOJIS } from '@uniclub/shared';

export interface IGameConfig extends Document {
  gameType: MindGameType | 'quiz_arena' | 'boss_battle';
  gomoku?: GomokuConfig;
  cardFlip?: CardFlipConfig;
  quizArena?: QuizArenaConfig;
  bossBattle?: BossBattleConfig;
  updatedAt: Date;
}

const GomokuConfigSchema = new Schema<GomokuConfig>(
  {
    matchmakingTimeout: { type: Number, required: true, default: 30 },
    opponentMode: { type: String, required: true, enum: ['mixed', 'bot_only'], default: 'mixed' },
    botActivationSeconds: { type: Number, required: true, default: 15 },
    winPoints: { type: Number, required: true, default: 100 },
    boardSize: { type: Number, required: true, default: 15 },
    turnTimeout: { type: Number, required: true, default: 120 },
    maxGameDuration: { type: Number, required: true, default: 600 },
  },
  { _id: false },
);

const CardFlipItemSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['emoji', 'image'] },
    value: { type: String, required: true },
  },
  { _id: false },
);

const CardFlipConfigSchema = new Schema<CardFlipConfig>(
  {
    matchmakingTimeout: { type: Number, required: true, default: 30 },
    opponentMode: { type: String, required: true, enum: ['mixed', 'bot_only'], default: 'mixed' },
    botActivationSeconds: { type: Number, required: true, default: 15 },
    winPoints: { type: Number, required: true, default: 50 },
    pairCount: { type: Number, required: true, default: 8 },
    cardItems: { type: [CardFlipItemSchema], default: undefined },
    // Cơ bản: tổng thời gian trận (giây)
    basicTotalTime: { type: Number, required: true, default: 60 },
    // Nâng cao: quỹ giờ xuất phát mỗi người + cộng giờ khi ghép đúng (giây)
    advancedStartTime: { type: Number, required: true, default: 45 },
    timeBonusOnMatch: { type: Number, required: true, default: 3 },
    // Cơ bản: auto-pass lượt khi AFK (giây)
    turnTimeout: { type: Number, required: true, default: 30 },
    // Tốc độ lật thẻ của bot (mili giây)
    botFlipDelayMs: { type: Number, required: true, default: 900 },
  },
  { _id: false },
);

const QuizArenaConfigSchema = new Schema<QuizArenaConfig>(
  {
    questionsPerMatch: { type: Number, required: true, default: 10 },
    maxPointsPerQuestion: { type: Number, required: true, default: 1000 },
    minScoreRetention: { type: Number, required: true, default: 0.5 },
    uniPointsPerCorrect: { type: Number, required: true, default: 10 },
    matchmakingTimeout: { type: Number, required: true, default: 30 },
    opponentMode: { type: String, required: true, enum: ['mixed', 'bot_only'], default: 'mixed' },
    realPlayerSearchSeconds: { type: Number, required: true, default: 15 }, // @deprecated - dùng botActivationSeconds
    botActivationSeconds: { type: Number, required: true, default: 15 },
    easyQuestionThreshold: { type: Number, required: true, default: 0.75 },
    hardQuestionThreshold: { type: Number, required: true, default: 0.40 },
    easyPlayerThreshold: { type: Number, required: true, default: 0.45 },
    hardPlayerThreshold: { type: Number, required: true, default: 0.75 },
    recentMatchesForAbility: { type: Number, required: true, default: 5 },
    afkConsecutiveMisses: { type: Number, required: true, default: 3 },
    nextQuestionDelayMs: { type: Number, required: true, default: 3000 },
    inviteEnabled: { type: Boolean, required: true, default: true },
    maxGamesPerRoom: { type: Number, required: true, default: 3, min: 1 },
    inviteHostWinMultiplier: { type: Number, required: true, default: 2, min: 1 },
    inviteBlockSameDevice: { type: Boolean, required: true, default: true },
    emojiEnabled: { type: Boolean, required: true, default: true },
    emojiPalette: { type: [String], required: true, default: () => [...DEFAULT_PROVOKE_EMOJIS] },
    emojiCooldownMs: { type: Number, required: true, default: 3000, min: 0 },
  },
  { _id: false },
);

const BossStateImageSchema = new Schema<BossStateImage>(
  {
    minPercent: { type: Number, required: true, min: 0, max: 100 },
    maxPercent: { type: Number, required: true, min: 0, max: 100 },
    img: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const BossBattleConfigSchema = new Schema<BossBattleConfig>(
  {
    hpMax: { type: Number, required: true, default: 50000, min: 1 },
    questionsPerDay: { type: Number, required: true, default: 5, min: 1 },
    questionsPerWeek: { type: Number, required: true, default: 35, min: 1 },
    basePoint: { type: Number, required: true, default: 10, min: 0 },
    maxSpeedBonus: { type: Number, required: true, default: 5, min: 0 },
    tMaxSec: { type: Number, required: true, default: 60, min: 1 },
    bossName: { type: String, required: true, default: 'Hắc Long Tri Thức', trim: true },
    bossStates: { type: [BossStateImageSchema], default: [] },
    weeklyFrameImageUrl: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const GameConfigSchema = new Schema<IGameConfig>(
  {
    gameType: {
      type: String,
      required: true,
      unique: true,
      enum: ['gomoku', 'card_flip', 'quiz_arena', 'boss_battle'],
    },
    gomoku: { type: GomokuConfigSchema },
    cardFlip: { type: CardFlipConfigSchema },
    quizArena: { type: QuizArenaConfigSchema },
    bossBattle: { type: BossBattleConfigSchema },
  },
  { timestamps: true },
);

export const GameConfigModel = mongoose.model<IGameConfig>('GameConfig', GameConfigSchema);

// ---- User Score ----

const GameScoreDetailSchema = new Schema(
  {
    points: { type: Number, default: 0 },
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
  },
  { _id: false },
);

export interface IUserScore extends Document {
  userId: string;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  mind_game: { points: number; played: number; won: number };
  quiz_arena: { points: number; played: number; won: number };
  boss_battle: { points: number; played: number; won: number };
  weekly_event: { points: number; played: number; won: number };
  gomoku: { points: number; played: number; won: number };
  card_flip: { points: number; played: number; won: number };
  lastPlayedAt?: Date;
}

const UserScoreSchema = new Schema<IUserScore>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    totalPoints: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    mind_game: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    quiz_arena: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    boss_battle: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    weekly_event: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    gomoku: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    card_flip: { type: GameScoreDetailSchema, default: () => ({ points: 0, played: 0, won: 0 }) },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true },
);

UserScoreSchema.index({ gamesPlayed: 1, lastPlayedAt: 1 });

export const UserScoreModel = mongoose.model<IUserScore>('UserScore', UserScoreSchema);

// ============================================================
// Quiz Arena — Question Bank
// ============================================================

export interface IQuestion extends Document {
  grade: number;
  content: string;
  options: [string, string, string, string];
  correctIndex: number;
  timeLimitSeconds: number;
  difficultyBucket: QuizDifficulty | null;
  totalAttempts: number;
  totalCorrect: number;
  correctRate: number | null;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    grade: { type: Number, required: true, min: 1, max: 12 },
    content: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length === 4, 'options must have exactly 4 items'],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    timeLimitSeconds: { type: Number, required: true, default: 20, min: 5, max: 120 },
    difficultyBucket: { type: String, enum: ['easy', 'medium', 'hard', null], default: null },
    totalAttempts: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    correctRate: { type: Number, default: null },
  },
  { timestamps: true },
);

// Index tối ưu cho query pickup câu hỏi theo grade + bucket
QuestionSchema.index({ grade: 1, difficultyBucket: 1 });

export const QuestionModel = mongoose.model<IQuestion>('Question', QuestionSchema);

// ============================================================
// Quiz Arena — User Match History (để tính ability bucket)
// ============================================================

export interface IUserMatchHistory extends Document {
  userId: string;
  gameType: 'quiz_arena';
  correctCount: number;
  totalQuestions: number;
  playedAt: Date;
}

const UserMatchHistorySchema = new Schema<IUserMatchHistory>(
  {
    userId: { type: String, required: true, index: true },
    gameType: { type: String, required: true, enum: ['quiz_arena'], default: 'quiz_arena' },
    correctCount: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    playedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

// Index để query N trận gần nhất theo userId + playedAt desc
UserMatchHistorySchema.index({ userId: 1, gameType: 1, playedAt: -1 });

export const UserMatchHistoryModel = mongoose.model<IUserMatchHistory>('UserMatchHistory', UserMatchHistorySchema);

// ============================================================
// Bot Profile — Kho tên + avatar cho AI Bot
// ============================================================

export interface IBotProfile extends Document {
  name: string;
  avatar: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BotProfileSchema = new Schema<IBotProfile>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    avatar: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// Index cho query list active bots
BotProfileSchema.index({ isActive: 1 });

export const BotProfileModel = mongoose.model<IBotProfile>('BotProfile', BotProfileSchema);

// ============================================================
// User Profile — Lưu thông tin người dùng từ JWT
// ============================================================

export interface IUser extends Document {
  userId: string;
  name: string;
  grade?: number;
  avatar?: string;
  type?: 'user' | 'guest';
  lastSeenAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    grade: { type: Number, min: 1, max: 12 },
    avatar: { type: String, trim: true },
    type: { type: String, enum: ['user', 'guest'], default: 'user' },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

UserSchema.index({ lastSeenAt: 1 });
UserSchema.index({ createdAt: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

// ============================================================
// Admin User — Tài khoản admin cho CMS
// ============================================================

import type { AdminRole } from '@uniclub/shared';

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
  createdAt: Date;
  lastLoginAt?: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['admin', 'superadmin'], default: 'admin' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const AdminUserModel = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

// ============================================================
// Boss Battle (Săn Boss) — DM-02..DM-09
// ============================================================

// ---- DM-06 BossQuestion ----

export interface IBossQuestion extends Document {
  grade: number;
  content: string;
  imageUrl?: string;
  options: [string, string, string, string];
  correctIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BossQuestionSchema = new Schema<IBossQuestion>(
  {
    grade: { type: Number, required: true, min: 1, max: 12 },
    content: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    options: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length === 4, 'options must have exactly 4 items'],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

BossQuestionSchema.index({ grade: 1, isActive: 1 });

export const BossQuestionModel = mongoose.model<IBossQuestion>('BossQuestion', BossQuestionSchema, 'bb_boss_questions');

// ---- DM-02 BossInstance ----

export interface IBossInstance extends Document {
  weekKey: string;
  gradeLevel: number;
  config: BossBattleConfig;
  totalPointsEarned: number;
  progressPercent: number;
  currentBossStateImg: string;
  status: BossInstanceStatus;
  createdAt: Date;
  defeatedAt?: Date | null;
  closedAt?: Date | null;
}

const BossInstanceSchema = new Schema<IBossInstance>(
  {
    weekKey: { type: String, required: true, index: true },
    gradeLevel: { type: Number, required: true, min: 1, max: 12 },
    config: { type: BossBattleConfigSchema, required: true },
    totalPointsEarned: { type: Number, required: true, default: 0 },
    progressPercent: { type: Number, required: true, default: 0 },
    currentBossStateImg: { type: String, default: '' },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'DEFEATED', 'CLOSED'],
      default: 'ACTIVE',
    },
    defeatedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BossInstanceSchema.index({ weekKey: 1, gradeLevel: 1 }, { unique: true });

export const BossInstanceModel = mongoose.model<IBossInstance>('BossInstance', BossInstanceSchema, 'bb_boss_instances');

// ---- DM-03 StudentBossProgress ----

export interface IStudentBossProgress extends Document {
  studentId: string;
  bossInstanceId: mongoose.Types.ObjectId;
  weekKey: string;
  gradeLevel: number;
  correctCountWeek: number;
  totalCorrectTimeSec: number;
  lastAchievedAt: Date | null;
  pointsContributedWeek: number;
}

const StudentBossProgressSchema = new Schema<IStudentBossProgress>(
  {
    studentId: { type: String, required: true, index: true },
    bossInstanceId: { type: Schema.Types.ObjectId, ref: 'BossInstance', required: true },
    weekKey: { type: String, required: true },
    gradeLevel: { type: Number, required: true },
    correctCountWeek: { type: Number, required: true, default: 0 },
    totalCorrectTimeSec: { type: Number, required: true, default: 0 },
    lastAchievedAt: { type: Date, default: null },
    pointsContributedWeek: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

StudentBossProgressSchema.index({ studentId: 1, weekKey: 1 }, { unique: true });
// Leaderboard sort (4 tiêu chí, đồng hạng khi trùng cả 4):
//   (1) pointsContributedWeek desc (2) correctCountWeek desc
//   (3) totalCorrectTimeSec asc (đến ms) (4) lastAchievedAt asc
StudentBossProgressSchema.index({
  weekKey: 1,
  gradeLevel: 1,
  pointsContributedWeek: -1,
  correctCountWeek: -1,
  totalCorrectTimeSec: 1,
  lastAchievedAt: 1,
});

export const StudentBossProgressModel = mongoose.model<IStudentBossProgress>(
  'StudentBossProgress',
  StudentBossProgressSchema,
  'bb_student_boss_progress',
);

// ---- DM-04 DailyAttempt ----

export interface IDailyAttempt extends Document {
  studentId: string;
  bossInstanceId: mongoose.Types.ObjectId;
  dateKey: string;
  dayIndex: number;
  questionSetId: mongoose.Types.ObjectId;
  status: DailyAttemptStatus;
  correctCount: number;
  totalResponseTime: number;
  pointsEarned: number;
  currentQuestionIndex: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

const DailyAttemptSchema = new Schema<IDailyAttempt>(
  {
    studentId: { type: String, required: true },
    bossInstanceId: { type: Schema.Types.ObjectId, ref: 'BossInstance', required: true },
    dateKey: { type: String, required: true },
    dayIndex: { type: Number, required: true, min: 1, max: 7 },
    questionSetId: { type: Schema.Types.ObjectId, ref: 'BossQuestionSet', required: true },
    status: {
      type: String,
      required: true,
      enum: ['LOCKED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
    },
    correctCount: { type: Number, required: true, default: 0 },
    totalResponseTime: { type: Number, required: true, default: 0 },
    pointsEarned: { type: Number, required: true, default: 0 },
    currentQuestionIndex: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

DailyAttemptSchema.index(
  { studentId: 1, bossInstanceId: 1, dateKey: 1 },
  { unique: true },
);

DailyAttemptSchema.index({ createdAt: 1 });
DailyAttemptSchema.index({ status: 1, createdAt: 1 });

export const DailyAttemptModel = mongoose.model<IDailyAttempt>('DailyAttempt', DailyAttemptSchema, 'bb_daily_attempts');

// ---- DM-05 BossQuestionSet ----

export interface IBossQuestionSet extends Document {
  weekKey: string;
  gradeLevel: number;
  dayIndex: number;
  questionIds: mongoose.Types.ObjectId[];
}

const BossQuestionSetSchema = new Schema<IBossQuestionSet>(
  {
    weekKey: { type: String, required: true },
    gradeLevel: { type: Number, required: true, min: 1, max: 12 },
    dayIndex: { type: Number, required: true, min: 1, max: 7 },
    questionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'BossQuestion' }],
      default: [],
    },
  },
  { timestamps: true },
);

BossQuestionSetSchema.index(
  { weekKey: 1, gradeLevel: 1, dayIndex: 1 },
  { unique: true },
);

export const BossQuestionSetModel = mongoose.model<IBossQuestionSet>(
  'BossQuestionSet',
  BossQuestionSetSchema,
  'bb_boss_question_sets',
);

// ---- DM-07 BossAnswerRecord ----

export interface IBossAnswerRecord extends Document {
  dailyAttemptId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  selectedIndex: number | null;
  isCorrect: boolean;
  responseTimeSec: number;
  pointsAwarded: number;
  answeredAt: Date;
}

const BossAnswerRecordSchema = new Schema<IBossAnswerRecord>(
  {
    dailyAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'DailyAttempt',
      required: true,
      index: true,
    },
    questionId: { type: Schema.Types.ObjectId, ref: 'BossQuestion', required: true },
    selectedIndex: { type: Number, default: null, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true, default: false },
    responseTimeSec: { type: Number, required: true, default: 0 },
    pointsAwarded: { type: Number, required: true, default: 0 },
    answeredAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

export const BossAnswerRecordModel = mongoose.model<IBossAnswerRecord>(
  'BossAnswerRecord',
  BossAnswerRecordSchema,
  'bb_boss_answer_records',
);

// ---- DM-09 WeeklyHonor ----

export interface IWeeklyHonor extends Document {
  weekKey: string;
  gradeLevel: number;
  studentId: string;
  displayName: string;
  avatar?: string;
  rank: number;
  correctCountWeek: number;
  totalCorrectTimeSec: number;
  pointsContributedWeek: number;
  frameGranted: boolean;
  frameExpiry: Date;
  bannerActive: boolean;
  createdAt: Date;
}

const WeeklyHonorSchema = new Schema<IWeeklyHonor>(
  {
    weekKey: { type: String, required: true },
    gradeLevel: { type: Number, required: true, min: 1, max: 12 },
    studentId: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
    rank: { type: Number, required: true, min: 1 },
    correctCountWeek: { type: Number, required: true, default: 0 },
    totalCorrectTimeSec: { type: Number, required: true, default: 0 },
    pointsContributedWeek: { type: Number, required: true, default: 0 },
    frameGranted: { type: Boolean, required: true, default: true },
    frameExpiry: { type: Date, required: true },
    bannerActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

WeeklyHonorSchema.index({ weekKey: 1, gradeLevel: 1, rank: 1 }, { unique: true });
WeeklyHonorSchema.index({ studentId: 1, frameExpiry: 1 });

export const WeeklyHonorModel = mongoose.model<IWeeklyHonor>('WeeklyHonor', WeeklyHonorSchema, 'bb_weekly_honors');

// ---- DM-10 BossWeeklyConfig (override config theo tuần × khối) ----

export interface IBossWeeklyConfig extends Document {
  weekKey: string;
  gradeLevel: number;
  /** Chỉ chứa các field thuộc OVERRIDABLE_BOSS_BATTLE_FIELDS */
  overrides: BossBattleConfigOverride;
  createdAt: Date;
  updatedAt: Date;
}

const BossWeeklyConfigSchema = new Schema<IBossWeeklyConfig>(
  {
    weekKey: { type: String, required: true },
    gradeLevel: { type: Number, required: true, min: 1, max: 12 },
    overrides: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true },
);

BossWeeklyConfigSchema.index({ weekKey: 1, gradeLevel: 1 }, { unique: true });

export const BossWeeklyConfigModel = mongoose.model<IBossWeeklyConfig>(
  'BossWeeklyConfig',
  BossWeeklyConfigSchema,
  'bb_boss_weekly_configs',
);

// ============================================================
// Weekly Event (Sự kiện tuần) — DATA-M-001..DATA-M-007
// ============================================================

import type {
  WeeklyEventGeneralConfig,
  WeeklyEventStatus,
  WeeklyEventRoomStatus,
  SubmissionType,
  ExamOption,
  ExamQuestion,
  WeeklyEventAnswer,
  LeaderboardEntry,
} from '@uniclub/shared';

// ---- DATA-M-001: WeeklyEventGeneralConfig (singleton) ----

export interface IWeeklyEventGeneralConfig extends Document {
  defaultWaitingDuration: number;
  defaultExamDuration: number;
  defaultLeaderboardDuration: number;
  leaderboardLimit: number;
  pointsPerCorrect: number;
  defaultActiveGrades: number[];
  timezone: string;
  updatedAt: Date;
  updatedBy?: string;
}

const WeeklyEventGeneralConfigSchema = new Schema<IWeeklyEventGeneralConfig>(
  {
    _id: { type: Schema.Types.Mixed, default: 'singleton' },
    defaultWaitingDuration: { type: Number, required: true, default: 5, min: 1 },
    defaultExamDuration: { type: Number, required: true, default: 20, min: 1 },
    defaultLeaderboardDuration: { type: Number, required: true, default: 5, min: 1 },
    leaderboardLimit: { type: Number, required: true, default: 10, min: 1 },
    pointsPerCorrect: { type: Number, required: true, default: 10, min: 1 },
    defaultActiveGrades: {
      type: [Number],
      required: true,
      default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    timezone: { type: String, required: true, default: 'Asia/Ho_Chi_Minh' },
    updatedBy: { type: String },
  },
  { timestamps: { updatedAt: true, createdAt: false } },
);

export const WeeklyEventGeneralConfigModel = mongoose.model<IWeeklyEventGeneralConfig>(
  'WeeklyEventGeneralConfig',
  WeeklyEventGeneralConfigSchema,
  'we_general_config',
);

// ---- DATA-M-002: WeeklyEvent ----

export interface IWeeklyEvent extends Document {
  weekNumber: number;
  year: number;
  title: string;
  scheduledStartAt: Date;
  actualStartAt?: Date | null;
  actualEndAt?: Date | null;
  waitingDuration: number;
  examDuration: number;
  leaderboardDuration: number;
  questionCountOverride: number;
  activeGrades: number[];
  status: WeeklyEventStatus;
  examAssignments: Record<string, string>;
  createdAt: Date;
  createdBy?: string;
}

const WeeklyEventSchema = new Schema<IWeeklyEvent>(
  {
    weekNumber: { type: Number, required: true, min: 1, max: 53 },
    year: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    scheduledStartAt: { type: Date, required: true },
    actualStartAt: { type: Date, default: null },
    actualEndAt: { type: Date, default: null },
    waitingDuration: { type: Number, required: true, default: 5 },
    examDuration: { type: Number, required: true, default: 20 },
    leaderboardDuration: { type: Number, required: true, default: 5 },
    questionCountOverride: { type: Number, required: true, default: 25 },
    activeGrades: { type: [Number], required: true, default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    status: {
      type: String,
      required: true,
      enum: ['Draft', 'Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing', 'Closed', 'Cancelled'],
      default: 'Draft',
    },
    examAssignments: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

WeeklyEventSchema.index({ status: 1, scheduledStartAt: 1 });
WeeklyEventSchema.index({ weekNumber: 1, year: 1 }, { unique: true });

export const WeeklyEventModel = mongoose.model<IWeeklyEvent>(
  'WeeklyEvent',
  WeeklyEventSchema,
  'we_events',
);

// ---- DATA-M-003: WeeklyEventRoom ----

export interface IWeeklyEventRoom extends Document {
  eventId: mongoose.Types.ObjectId;
  grade: number;
  examId?: string;
  status: WeeklyEventRoomStatus;
  stateTransitions: { to: string; at: Date }[];
  participantCount: number;
  submittedCount: number;
}

const WeeklyEventRoomSchema = new Schema<IWeeklyEventRoom>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', required: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    examId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing', 'Closed', 'Cancelled'],
      default: 'Scheduled',
    },
    stateTransitions: {
      type: [{ to: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
    participantCount: { type: Number, default: 0 },
    submittedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

WeeklyEventRoomSchema.index({ eventId: 1, grade: 1 }, { unique: true });
WeeklyEventRoomSchema.index({ status: 1, eventId: 1 });

export const WeeklyEventRoomModel = mongoose.model<IWeeklyEventRoom>(
  'WeeklyEventRoom',
  WeeklyEventRoomSchema,
  'we_rooms',
);

// ---- DATA-M-004: ExamBank ----

const ExamOptionSchema = new Schema<ExamOption>(
  {
    key: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ExamQuestionSchema = new Schema<ExamQuestion>(
  {
    questionId: { type: String, required: true },
    stem: { type: String, required: true, trim: true },
    options: {
      type: [ExamOptionSchema],
      required: true,
      validate: [(v: ExamOption[]) => v.length === 4, 'options must have exactly 4 items'],
    },
    correctKey: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
    shuffleable: { type: Boolean, default: true },
  },
  { _id: false },
);

export interface IExamBank extends Document {
  grade: number;
  title: string;
  totalQuestions: number;
  questions: ExamQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const ExamBankSchema = new Schema<IExamBank>(
  {
    grade: { type: Number, required: true, min: 1, max: 12 },
    title: { type: String, required: true, trim: true },
    totalQuestions: { type: Number, required: true, default: 25 },
    questions: {
      type: [ExamQuestionSchema],
      required: true,
      validate: [
        (v: ExamQuestion[]) => v.length > 0 && v.length <= 100,
        'questions must have 1-100 items',
      ],
    },
  },
  { timestamps: true },
);

ExamBankSchema.index({ grade: 1 });

export const ExamBankModel = mongoose.model<IExamBank>(
  'ExamBank',
  ExamBankSchema,
  'we_exam_bank',
);

// ---- DATA-M-005: WeeklyEventParticipation ----

export interface IWeeklyEventParticipation extends Document {
  eventId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  studentId: string;
  grade: number;
  joinedAt: Date;
  examStartedAt?: Date | null;
  submittedAt?: Date | null;
  submissionType?: SubmissionType;
  disconnectCount: number;
  shuffleSeed: string;
}

const WeeklyEventParticipationSchema = new Schema<IWeeklyEventParticipation>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'WeeklyEventRoom', required: true },
    studentId: { type: String, required: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    joinedAt: { type: Date, required: true, default: Date.now },
    examStartedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    submissionType: {
      type: String,
      enum: ['manual', 'auto_timeout', 'auto_disconnect'],
    },
    disconnectCount: { type: Number, default: 0 },
    shuffleSeed: { type: String, required: true },
  },
  { timestamps: true },
);

WeeklyEventParticipationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });
WeeklyEventParticipationSchema.index({ roomId: 1, submittedAt: 1 });

WeeklyEventParticipationSchema.index({ createdAt: 1 });

export const WeeklyEventParticipationModel = mongoose.model<IWeeklyEventParticipation>(
  'WeeklyEventParticipation',
  WeeklyEventParticipationSchema,
  'we_participations',
);

// ---- DATA-M-006: WeeklyEventResult ----

const WeeklyEventAnswerSchema = new Schema<WeeklyEventAnswer>(
  {
    questionId: { type: String, required: true },
    selectedKey: { type: String, default: null },
    isCorrect: { type: Boolean, required: true },
    answeredAt: { type: String, required: true },
  },
  { _id: false },
);

export interface IWeeklyEventResult extends Document {
  participationId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  studentId: string;
  correctCount: number;
  totalAnswered: number;
  totalTimeMs: number;
  lastCorrectAnswerAt?: Date;
  rank?: number;
  score: number;
  answers: WeeklyEventAnswer[];
}

const WeeklyEventResultSchema = new Schema<IWeeklyEventResult>(
  {
    participationId: { type: Schema.Types.ObjectId, ref: 'WeeklyEventParticipation', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'WeeklyEventRoom', required: true },
    studentId: { type: String, required: true },
    correctCount: { type: Number, required: true, default: 0 },
    totalAnswered: { type: Number, required: true, default: 0 },
    totalTimeMs: { type: Number, required: true, default: 0 },
    lastCorrectAnswerAt: { type: Date },
    rank: { type: Number },
    score: { type: Number, required: true, default: 0 },
    answers: { type: [WeeklyEventAnswerSchema], default: [] },
  },
  { timestamps: true },
);

WeeklyEventResultSchema.index({ eventId: 1, roomId: 1, rank: 1 });
WeeklyEventResultSchema.index({ studentId: 1, eventId: 1 });

WeeklyEventResultSchema.index({ createdAt: 1 });

export const WeeklyEventResultModel = mongoose.model<IWeeklyEventResult>(
  'WeeklyEventResult',
  WeeklyEventResultSchema,
  'we_results',
);

// ---- DATA-M-007: WeeklyEventLeaderboardSnapshot ----

const LeaderboardEntrySchema = new Schema<LeaderboardEntry>(
  {
    rank: { type: Number, required: true },
    studentId: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    correctCount: { type: Number, required: true },
    totalTimeMs: { type: Number, required: true },
  },
  { _id: false },
);

export interface IWeeklyEventLeaderboardSnapshot extends Document {
  eventId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  grade: number;
  topN: LeaderboardEntry[];
  computedAt: Date;
}

const WeeklyEventLeaderboardSnapshotSchema = new Schema<IWeeklyEventLeaderboardSnapshot>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'WeeklyEvent', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'WeeklyEventRoom', required: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    topN: { type: [LeaderboardEntrySchema], default: [] },
    computedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

WeeklyEventLeaderboardSnapshotSchema.index({ eventId: 1, roomId: 1 }, { unique: true });

export const WeeklyEventLeaderboardSnapshotModel = mongoose.model<IWeeklyEventLeaderboardSnapshot>(
  'WeeklyEventLeaderboardSnapshot',
  WeeklyEventLeaderboardSnapshotSchema,
  'we_leaderboard_snapshots',
);

// ============================================================
// Analytics — GameMatchLog (persist kết quả từng trận cho analytics)
// ============================================================

export interface IGameMatchLog extends Document {
  userId: string;
  gameType: 'quiz_arena' | 'gomoku' | 'card_flip' | 'boss_battle' | 'weekly_event';
  playTimeSec: number;
  sessionCompleted: boolean;
  isWin: boolean;
  points: number;
  correctCount?: number;
  totalQuestions?: number;
  playedAt: Date;
}

const GameMatchLogSchema = new Schema<IGameMatchLog>(
  {
    userId: { type: String, required: true, index: true },
    gameType: {
      type: String,
      required: true,
      enum: ['quiz_arena', 'gomoku', 'card_flip', 'boss_battle', 'weekly_event'],
    },
    playTimeSec: { type: Number, required: true, default: 0 },
    sessionCompleted: { type: Boolean, required: true, default: false },
    isWin: { type: Boolean, required: true, default: false },
    points: { type: Number, required: true, default: 0 },
    correctCount: { type: Number },
    totalQuestions: { type: Number },
    playedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// Analytics queries: filter by gameType + playedAt range
GameMatchLogSchema.index({ gameType: 1, playedAt: -1 });
// Per-user queries
GameMatchLogSchema.index({ userId: 1, gameType: 1, playedAt: -1 });

GameMatchLogSchema.index({ gameType: 1, sessionCompleted: 1, playedAt: -1 });

export const GameMatchLogModel = mongoose.model<IGameMatchLog>(
  'GameMatchLog',
  GameMatchLogSchema,
  'analytics_match_logs',
);

