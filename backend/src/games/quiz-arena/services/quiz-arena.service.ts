// ============================================================
// Quiz Arena — Core Service (So Tài)
// Vòng đời session: tạo → phát câu hỏi → nhận đáp án → kết thúc
// ============================================================

import { redis } from "../../../config/index";
import { ScoreService } from "../../../services/score.service";
import { MatchmakingService } from "../../../services/matchmaking.service";
import { BotProfileService } from "../../../services/bot-profile.service";
import { QuestionService } from "./question.service";
import { UserAbilityService } from "./user-ability.service";
import { QuizBotService } from "./quiz-bot.service";
import { UniClassSyncService } from "./uniclass-sync.service";
import { GameResultEventService } from "../../../services/game-result-event.service";
import {
  QUIZ_ARENA_REDIS_KEYS,
  QUIZ_ARENA_SOCKET_EVENTS,
  QUIZ_BOT_PROFILES,
} from "@uniclub/shared";
import type {
  QuizArenaSession,
  QuizArenaConfig,
  QuizDifficulty,
  QuizPlayerState,
  QuizPlayerAnswer,
  QuizQuestionPublic,
  QuizArenaResult,
  QuizPlayerSummary,
  QuizQuestion,
} from "@uniclub/shared";
import type { Server } from "socket.io";
import { UserService } from "../../../services";

// ---- Helpers ----

function generateSessionId(): string {
  return `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makePlayerState(
  userId: string,
  displayName: string,
  grade: number,
  avatar?: string,
): QuizPlayerState {
  return {
    userId,
    displayName,
    avatar,
    grade,
    totalScore: 0,
    correctCount: 0,
    totalCorrectTimeMs: 0,
    answers: [],
    consecutiveMisses: 0,
    disconnected: false,
    finalSubmittedAt: null,
    finished: false,
  };
}

/**
 * Tính điểm cho một câu trả lời đúng theo công thức decay:
 *   earned = maxPoints * (1 - minRetention * (responseTime / timeLimit))
 * Trả lời sai hoặc hết giờ → 0 điểm.
 */
function calcEarnedPoints(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitMs: number,
  maxPoints: number,
  minRetention: number,
): number {
  if (!isCorrect) return 0;
  const ratio = Math.min(responseTimeMs / timeLimitMs, 1);
  return Math.round(maxPoints * (1 - minRetention * ratio));
}

/**
 * Phân định thắng/thua (không hòa):
 * 1. Tổng điểm cao hơn thắng.
 * 2. Nếu bằng: totalCorrectTimeMs thấp hơn thắng.
 * 3. Nếu vẫn bằng: finalSubmittedAt sớm hơn thắng.
 * 4. Nếu vẫn bằng: playerA mặc định thắng (không xảy ra trong thực tế vì ms precision).
 */
function determineWinner(
  playerA: QuizPlayerState,
  playerB: QuizPlayerState,
): { winner: string; loser: string } {
  if (playerA.totalScore !== playerB.totalScore) {
    return playerA.totalScore > playerB.totalScore
      ? { winner: playerA.userId, loser: playerB.userId }
      : { winner: playerB.userId, loser: playerA.userId };
  }

  if (playerA.totalCorrectTimeMs !== playerB.totalCorrectTimeMs) {
    return playerA.totalCorrectTimeMs < playerB.totalCorrectTimeMs
      ? { winner: playerA.userId, loser: playerB.userId }
      : { winner: playerB.userId, loser: playerA.userId };
  }

  const tsA = playerA.finalSubmittedAt ?? Number.MAX_SAFE_INTEGER;
  const tsB = playerB.finalSubmittedAt ?? Number.MAX_SAFE_INTEGER;
  if (tsA !== tsB) {
    return tsA < tsB
      ? { winner: playerA.userId, loser: playerB.userId }
      : { winner: playerB.userId, loser: playerA.userId };
  }

  // Absolute tie (cực kỳ hiếm) — playerA thắng
  return { winner: playerA.userId, loser: playerB.userId };
}

function toPublicQuestion(
  q: QuizQuestion,
  questionIndex: number,
  totalQuestions: number,
  startedAt: number,
): QuizQuestionPublic {
  return {
    id: q.id,
    grade: q.grade,
    content: q.content,
    options: q.options,
    timeLimitSeconds: q.timeLimitSeconds,
    questionIndex,
    totalQuestions,
    startedAt,
  };
}

// ---- Session map timeouts (in-memory, không serialize vào Redis) ----

/** Map: sessionId → handle timeout auto-submit câu hỏi */
const questionTimeouts = new Map<string, NodeJS.Timeout>();
/** Map: sessionId → handle timeout next question */
const nextQuestionTimers = new Map<string, NodeJS.Timeout>();
/** Map: sessionId → handle timeout bot turn */
const botTurnTimers = new Map<string, NodeJS.Timeout>();
/**
 * Map: sessionId → handle timeout kết thúc trận khi user disconnect (Bot match).
 * Cho user 30s để reconnect trước khi end match.
 */
const disconnectTimers = new Map<string, NodeJS.Timeout>();

/** Thời gian chờ reconnect trước khi kết thúc trận Bot (giây) */
const BOT_DISCONNECT_GRACE_SECONDS = 30;

// ============================================================
// Main Service Class
// ============================================================

export class QuizArenaService {
  // ---- Session CRUD (Redis) ----

  static async getSession(sessionId: string): Promise<QuizArenaSession | null> {
    const data = await redis.get(
      `${QUIZ_ARENA_REDIS_KEYS.SESSION}:${sessionId}`,
    );
    if (!data) return null;
    const session = JSON.parse(data) as QuizArenaSession;
    session.playerAData = await UserService.getUser(session.playerA);
    if (session.isBot && session.playerB) {
      session.playerBData = {
        userId: session.playerB,
        name: session.playerBState.displayName ?? "",
        avatar: session.playerBState.avatar,
        grade: session.playerBState.grade,
      };
    } else {
      session.playerBData = await UserService.getUser(session.playerB);
    }
    return session;
  }

  static async saveSession(session: QuizArenaSession): Promise<void> {
    await redis.set(
      `${QUIZ_ARENA_REDIS_KEYS.SESSION}:${session.sessionId}`,
      JSON.stringify(session),
      "EX",
      1800, // 30 phút TTL
    );
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`${QUIZ_ARENA_REDIS_KEYS.SESSION}:${sessionId}`);
  }

  // ---- Session Factory ----

  /**
   * Tạo session PvP giữa 2 người chơi thật.
   */
  static async createPVPSession(
    playerA: string,
    playerAName: string,
    playerAGrade: number,
    playerB: string,
    playerBName: string,
    playerBGrade: number,
    abilityBucket: QuizDifficulty,
    config: QuizArenaConfig,
  ): Promise<QuizArenaSession> {
    const grade = playerAGrade; // cả 2 cùng khối (matchmaking đảm bảo)
    const recentIdsA =
      await QuestionService.getRecentQuestionIdsForUser(playerA);
    const recentIdsB =
      await QuestionService.getRecentQuestionIdsForUser(playerB);
    const excludeIds = [...new Set([...recentIdsA, ...recentIdsB])];

    const questions = await QuestionService.pickQuestionsForMatch(
      grade,
      abilityBucket,
      config.questionsPerMatch,
      excludeIds,
    );

    const sessionId = generateSessionId();

    const session: QuizArenaSession = {
      sessionId,
      playerA,
      playerB,
      grade,
      abilityBucket,
      isBot: false,
      questions,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: null,
      playerAState: makePlayerState(playerA, playerAName, grade),
      playerBState: makePlayerState(playerB, playerBName, playerBGrade),
      status: "waiting",
      winner: null,
      config,
      startedAt: new Date(),
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Tạo session vs AI Bot.
   * Trả về session và botProfile để hiển thị nhất quán trên UI.
   */
  static async createBotSession(
    userId: string,
    userName: string,
    userGrade: number,
    abilityBucket: QuizDifficulty,
    config: QuizArenaConfig,
  ): Promise<{
    session: QuizArenaSession;
    botProfile?: { name: string; avatar?: string };
  }> {
    // Lấy bot behavior profile theo độ khó
    const botBehaviorProfile = QUIZ_BOT_PROFILES[abilityBucket];

    // Lấy bot identity (name + avatar) từ pool
    const botIdentity = await BotProfileService.getRandomBot();
    const botName = botIdentity?.name ?? "Bot AI";
    const botAvatar = botIdentity?.avatar;
    const botId = `BOT_${Date.now()}`;

    const recentIds = await QuestionService.getRecentQuestionIdsForUser(userId);
    const questions = await QuestionService.pickQuestionsForMatch(
      userGrade,
      abilityBucket,
      config.questionsPerMatch,
      recentIds,
    );

    const sessionId = generateSessionId();

    const session: QuizArenaSession = {
      sessionId,
      playerA: userId,
      playerB: botId,
      grade: userGrade,
      abilityBucket,
      isBot: true,
      botDifficulty: abilityBucket,
      botProfile: botBehaviorProfile,
      questions,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: null,
      playerAState: makePlayerState(userId, userName, userGrade),
      playerBState: makePlayerState(botId, botName, userGrade, botAvatar),
      status: "waiting",
      winner: null,
      config,
      startedAt: new Date(),
    };

    await this.saveSession(session);
    return {
      session,
      botProfile: { name: botName, avatar: botAvatar },
    };
  }

  // ---- Gameplay ----

  /**
   * Bắt đầu câu hỏi tiếp theo (hoặc câu đầu tiên).
   * Broadcast QUIZ_QUESTION tới room.
   * Nếu là bot session → schedule bot turn.
   */
  static async startNextQuestion(sessionId: string, io: Server): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;

    const { currentQuestionIndex, questions, config } = session;

    if (currentQuestionIndex >= questions.length) {
      // Không còn câu nào — kết thúc trận
      await this.endMatch(sessionId, io);
      return;
    }

    const question = questions[currentQuestionIndex];
    const now = Date.now();
    session.currentQuestionStartedAt = now;

    await this.saveSession(session);

    // Broadcast câu hỏi (không có correctIndex)
    const publicQ = toPublicQuestion(
      question,
      currentQuestionIndex,
      questions.length,
      now,
    );
    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.QUESTION, publicQ);

    // Set timeout tự động submit null khi hết giờ
    const timeLimitMs = question.timeLimitSeconds * 1000;

    const prevTimeout = questionTimeouts.get(sessionId);
    if (prevTimeout) clearTimeout(prevTimeout);

    const handle = setTimeout(() => {
      questionTimeouts.delete(sessionId);
      this.handleQuestionTimeout(sessionId, currentQuestionIndex, io).catch(
        () => {},
      );
    }, timeLimitMs + 200); // +200ms buffer để đảm bảo client nhận đủ

    questionTimeouts.set(sessionId, handle);

    // Bot turn nếu là session vs AI
    if (session.isBot && session.botProfile) {
      const { selectedIndex, responseTimeMs } = QuizBotService.decide(
        question,
        session.botProfile,
      );
      const botHandle = setTimeout(() => {
        botTurnTimers.delete(sessionId);
        // Bot submit đáp án
        this.submitAnswer(sessionId, session.playerB, selectedIndex, io).catch(
          () => {},
        );
      }, responseTimeMs);
      botTurnTimers.set(sessionId, botHandle);
    }
  }

  /**
   * Bắt đầu trận đấu (chuyển từ 'waiting' → 'playing').
   * Được gọi sau khi tất cả client join session room.
   */
  static async startMatch(sessionId: string, io: Server): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "waiting") return;

    session.status = "playing";
    await this.saveSession(session);

    await this.startNextQuestion(sessionId, io);
  }

  /**
   * Nhận đáp án từ user (hoặc null nếu hết giờ).
   * Server tính `responseTimeMs` từ `currentQuestionStartedAt` — không nhận từ client.
   */
  static async submitAnswer(
    sessionId: string,
    userId: string,
    selectedIndex: number | null,
    io: Server,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;

    const { currentQuestionIndex, questions, config } = session;
    const question = questions[currentQuestionIndex];
    if (!question) return;

    const isPlayerA = session.playerA === userId;
    const isPlayerB = session.playerB === userId;
    if (!isPlayerA && !isPlayerB) return;

    const playerState = isPlayerA ? session.playerAState : session.playerBState;

    // Đã trả lời câu này rồi — bỏ qua (đề phòng duplicate)
    if (playerState.answers.length > currentQuestionIndex) return;

    const now = Date.now();
    const startedAt = session.currentQuestionStartedAt ?? now;
    const timeLimitMs = question.timeLimitSeconds * 1000;
    const responseTimeMs = Math.min(now - startedAt, timeLimitMs);

    const isCorrect =
      selectedIndex !== null && selectedIndex === question.correctIndex;
    const earnedPoints = calcEarnedPoints(
      isCorrect,
      responseTimeMs,
      timeLimitMs,
      config.maxPointsPerQuestion,
      config.minScoreRetention,
    );

    const answerRecord: QuizPlayerAnswer = {
      questionId: question.id,
      selectedIndex,
      responseTimeMs: selectedIndex !== null ? responseTimeMs : null,
      isCorrect,
      earnedPoints,
    };

    playerState.answers.push(answerRecord);
    playerState.totalScore += earnedPoints;

    if (isCorrect) {
      playerState.correctCount++;
      playerState.totalCorrectTimeMs += responseTimeMs;
      playerState.consecutiveMisses = 0;
    } else if (selectedIndex === null) {
      // AFK (không trả lời)
      playerState.consecutiveMisses++;
    } else {
      // Trả lời sai — reset AFK counter
      playerState.consecutiveMisses = 0;
    }

    playerState.finalSubmittedAt = now;

    // Cập nhật stats câu hỏi (chỉ khi user thật, không đếm bot)
    if (!session.isBot || isPlayerA) {
      QuestionService.recordAttempt(
        question.id,
        isCorrect,
        config.easyQuestionThreshold,
        config.hardQuestionThreshold,
      ).catch(() => {});
    }

    // Notify đối thủ: opponent đã trả lời (không tiết lộ đáp án)
    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.OPPONENT_ANSWERED, {
      questionIndex: currentQuestionIndex,
      respondentId: userId,
    });

    // Kiểm tra AFK quá nhiều câu liên tiếp
    if (playerState.consecutiveMisses >= config.afkConsecutiveMisses) {
      // Auto-fill null cho các câu còn lại của người này
      playerState.finished = true;
      await this.saveSession(session);
      await this.handleAfkForfeit(sessionId, userId, io);
      return;
    }

    await this.saveSession(session);

    // Kiểm tra cả 2 đã trả lời chưa
    const otherState = isPlayerA ? session.playerBState : session.playerAState;
    const bothAnswered =
      playerState.answers.length > currentQuestionIndex &&
      otherState.answers.length > currentQuestionIndex;

    if (bothAnswered) {
      await this.resolveQuestion(sessionId, io);
    }
  }

  /**
   * Xử lý khi hết giờ một câu hỏi — auto-submit null cho ai chưa trả lời.
   */
  static async handleQuestionTimeout(
    sessionId: string,
    questionIndex: number,
    io: Server,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;
    if (session.currentQuestionIndex !== questionIndex) return;

    // Clear bot timer nếu có
    const botHandle = botTurnTimers.get(sessionId);
    if (botHandle) {
      clearTimeout(botHandle);
      botTurnTimers.delete(sessionId);
    }

    // Submit null cho ai chưa trả lời
    const { playerAState, playerBState } = session;
    const needsA = playerAState.answers.length <= questionIndex;
    const needsB = playerBState.answers.length <= questionIndex;

    if (needsA) {
      await this.submitAnswer(sessionId, session.playerA, null, io);
    }
    if (needsB) {
      await this.submitAnswer(sessionId, session.playerB, null, io);
    }
  }

  // ---- Private helpers ----

  /**
   * Sau khi cả 2 đã trả lời: emit kết quả, schedule câu hỏi tiếp theo.
   */
  private static async resolveQuestion(
    sessionId: string,
    io: Server,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;

    const { currentQuestionIndex, questions, config } = session;
    const question = questions[currentQuestionIndex];

    const answerA = session.playerAState.answers[currentQuestionIndex];
    const answerB = session.playerBState.answers[currentQuestionIndex];

    // Emit kết quả câu hỏi (tiết lộ correctIndex)
    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.QUESTION_RESULT, {
      questionIndex: currentQuestionIndex,
      correctIndex: question.correctIndex,
      playerA: {
        userId: session.playerA,
        selectedIndex: answerA?.selectedIndex ?? null,
        isCorrect: answerA?.isCorrect ?? false,
        earnedPoints: answerA?.earnedPoints ?? 0,
        responseTimeMs: answerA?.responseTimeMs ?? null,
      },
      playerB: {
        userId: session.playerB,
        selectedIndex: answerB?.selectedIndex ?? null,
        isCorrect: answerB?.isCorrect ?? false,
        earnedPoints: answerB?.earnedPoints ?? 0,
        responseTimeMs: answerB?.responseTimeMs ?? null,
      },
    });

    // Emit state tổng thể
    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.STATE, {
      playerA: this.toPublicPlayerState(session.playerAState),
      playerB: this.toPublicPlayerState(session.playerBState),
    });

    const isLastQuestion = currentQuestionIndex >= questions.length - 1;

    if (isLastQuestion) {
      // Kết thúc trận sau delay
      const handle = setTimeout(() => {
        nextQuestionTimers.delete(sessionId);
        this.endMatch(sessionId, io).catch(() => {});
      }, config.nextQuestionDelayMs);
      nextQuestionTimers.set(sessionId, handle);
    } else {
      // Chuyển sang câu kế sau delay
      session.currentQuestionIndex++;
      await this.saveSession(session);

      const handle = setTimeout(() => {
        nextQuestionTimers.delete(sessionId);
        this.startNextQuestion(sessionId, io).catch(() => {});
      }, config.nextQuestionDelayMs);
      nextQuestionTimers.set(sessionId, handle);
    }
  }

  /**
   * Khi user AFK quá nhiều câu liên tiếp: chốt thua.
   */
  private static async handleAfkForfeit(
    sessionId: string,
    afkUserId: string,
    io: Server,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;

    const { config, questions, currentQuestionIndex } = session;
    const isPlayerA = session.playerA === afkUserId;
    const afkState = isPlayerA ? session.playerAState : session.playerBState;
    const opponentState = isPlayerA
      ? session.playerBState
      : session.playerAState;

    // Auto-fill null answers cho AFK user từ câu hiện tại đến hết
    for (let i = afkState.answers.length; i < questions.length; i++) {
      afkState.answers.push({
        questionId: questions[i].id,
        selectedIndex: null,
        responseTimeMs: null,
        isCorrect: false,
        earnedPoints: 0,
      });
    }
    afkState.finished = true;

    // Đối thủ nhận điểm tối đa cho các câu còn lại (tính như trả lời đúng)
    for (let i = opponentState.answers.length; i < questions.length; i++) {
      const q = questions[i];
      // Giả lập thời gian phản xạ hợp lý để kết quả trông thực tế
      const simulatedResponseMs = Math.floor(
        Math.random() * 4000 + 2000, // 2-6 giây, realistic
      );
      opponentState.answers.push({
        questionId: q.id,
        selectedIndex: q.correctIndex,
        responseTimeMs: simulatedResponseMs,
        isCorrect: true,
        earnedPoints: config.maxPointsPerQuestion,
      });
      opponentState.correctCount++;
      opponentState.totalCorrectTimeMs += simulatedResponseMs;
      opponentState.totalScore += config.maxPointsPerQuestion;
    }
    opponentState.finished = true;

    session.currentQuestionIndex = questions.length - 1; // jump to end
    await this.saveSession(session);
    await this.endMatch(sessionId, io);
  }

  /**
   * Kết thúc trận, tính kết quả, cập nhật score, enqueue sync.
   */
  static async endMatch(sessionId: string, io: Server): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status === "finished") return;

    // Clear all pending timers
    const qTimeout = questionTimeouts.get(sessionId);
    if (qTimeout) {
      clearTimeout(qTimeout);
      questionTimeouts.delete(sessionId);
    }
    const nqTimer = nextQuestionTimers.get(sessionId);
    if (nqTimer) {
      clearTimeout(nqTimer);
      nextQuestionTimers.delete(sessionId);
    }
    const botTimer = botTurnTimers.get(sessionId);
    if (botTimer) {
      clearTimeout(botTimer);
      botTurnTimers.delete(sessionId);
    }
    const dcTimer = disconnectTimers.get(sessionId);
    if (dcTimer) {
      clearTimeout(dcTimer);
      disconnectTimers.delete(sessionId);
    }

    session.status = "finished";
    session.endedAt = new Date();

    const { winner, loser } = determineWinner(
      session.playerAState,
      session.playerBState,
    );
    session.winner = winner;

    const { config } = session;

    // Tính UniPoints (dựa trên số câu đúng, cả 2 đều nhận)
    const uniA = session.playerAState.correctCount * config.uniPointsPerCorrect;
    const uniB = session.playerBState.correctCount * config.uniPointsPerCorrect;

    // Cập nhật score nội bộ (chỉ cho user thật, không lưu score của Bot)
    const isPlayerAWinner = winner === session.playerA;

    if (!session.isBot) {
      await Promise.all([
        ScoreService.addWinPoints(
          isPlayerAWinner ? session.playerA : session.playerB,
          isPlayerAWinner ? uniA : uniB,
          "quiz_arena",
        ),
        ScoreService.recordLoss(
          isPlayerAWinner ? session.playerB : session.playerA,
          "quiz_arena",
        ),
      ]);
    } else {
      // Bot match: chỉ lưu score cho user thật (playerA luôn là user thật)
      if (isPlayerAWinner) {
        await ScoreService.addWinPoints(session.playerA, uniA, "quiz_arena");
      } else {
        await ScoreService.recordLoss(session.playerA, "quiz_arena");
      }
    }

    // Enqueue sync về UniClass
    const now = new Date().toISOString();
    if (!session.isBot) {
      await UniClassSyncService.enqueueSync({
        userId: session.playerA,
        sessionId,
        correctCount: session.playerAState.correctCount,
        uniPointsEarned: uniA,
        playedAt: now,
      });
      await UniClassSyncService.enqueueSync({
        userId: session.playerB,
        sessionId,
        correctCount: session.playerBState.correctCount,
        uniPointsEarned: uniB,
        playedAt: now,
      });
    } else {
      await UniClassSyncService.enqueueSync({
        userId: session.playerA,
        sessionId,
        correctCount: session.playerAState.correctCount,
        uniPointsEarned: uniA,
        playedAt: now,
      });
    }

    // Ghi lịch sử ability cho user thật
    const recordAbility = async (
      userId: string,
      state: typeof session.playerAState,
    ) => {
      if (userId.startsWith("BOT_")) return;
      await UserAbilityService.recordMatchResult(
        userId,
        state.correctCount,
        session.questions.length,
        config.recentMatchesForAbility,
      );
    };
    console.log("Here 1");

    await Promise.all([
      recordAbility(session.playerA, session.playerAState),
      recordAbility(session.playerB, session.playerBState),
    ]);
    console.log("Here 2");

    // Ghi lịch sử câu hỏi đã làm
    await Promise.all([
      QuestionService.recordRecentQuestions(
        session.playerA,
        session.questions.map((q) => q.id),
      ),
      session.isBot
        ? Promise.resolve()
        : QuestionService.recordRecentQuestions(
            session.playerB,
            session.questions.map((q) => q.id),
          ),
    ]);
    console.log("Here 3");

    await this.saveSession(session);

    // Clear active session tracking cho cả 2 player (nếu không phải bot)
    await MatchmakingService.clearActiveSession(session.playerA);
    if (!session.isBot) {
      await MatchmakingService.clearActiveSession(session.playerB);
    }

    // Xây kết quả
    const result: QuizArenaResult = {
      sessionId,
      winner,
      loser,
      isBot: session.isBot,
      playerA: this.toPlayerSummary(session.playerAState, uniA),
      playerB: this.toPlayerSummary(session.playerBState, uniB),
    };

    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.END, result);

    // Emit Kafka event for UniClass integration
    await GameResultEventService.emitQuizArenaResult(session);
  }

  /**
   * Xử lý khi một player disconnect giữa trận.
   * - Bot match: đánh dấu disconnected, set timer 30s. Nếu user reconnect trong 30s → tiếp tục.
   *   Nếu hết 30s → endMatch (Bot thắng).
   * - PvP: đánh dấu disconnected, trận tiếp tục cho đối thủ (auto-submit null).
   *   Active session chỉ bị clear khi endMatch được gọi.
   */
  static async handleDisconnect(
    sessionId: string,
    userId: string,
    io: Server,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== "playing") return;

    const isPlayerA = session.playerA === userId;
    const playerState = isPlayerA ? session.playerAState : session.playerBState;

    // Tránh set lại nếu đã disconnected
    if (playerState.disconnected) return;

    playerState.disconnected = true;
    await this.saveSession(session);

    if (session.isBot) {
      // Bot match: set timer grace period, cho user cơ hội reconnect
      const existingTimer = disconnectTimers.get(sessionId);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        disconnectTimers.delete(sessionId);
        // Kiểm tra lại session — nếu user đã reconnect thì không end
        const currentSession = await QuizArenaService.getSession(sessionId);
        if (!currentSession || currentSession.status !== "playing") return;

        const userState =
          currentSession.playerA === userId
            ? currentSession.playerAState
            : currentSession.playerBState;
        // Nếu user đã reconnect (disconnected = false) thì bỏ qua
        if (!userState.disconnected) return;

        await QuizArenaService.endMatch(sessionId, io);
      }, BOT_DISCONNECT_GRACE_SECONDS * 1000);

      disconnectTimers.set(sessionId, timer);
    }

    // Thông báo cho đối thủ (nếu PvP)
    io.to(sessionId).emit(QUIZ_ARENA_SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
      userId,
    });
  }

  /**
   * Xử lý khi user reconnect sau khi bị disconnect.
   * Clear disconnect timer và reset disconnected flag.
   */
  static async handleReconnect(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    // Clear disconnect timer nếu có
    const timer = disconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(sessionId);
    }

    // Reset disconnected flag
    const session = await this.getSession(sessionId);
    if (!session) return;

    const isPlayerA = session.playerA === userId;
    const playerState = isPlayerA ? session.playerAState : session.playerBState;
    if (playerState.disconnected) {
      playerState.disconnected = false;
      await this.saveSession(session);
    }
  }

  // ---- Serialization helpers ----

  static toPublicPlayerState(
    state: QuizPlayerState,
  ): QuizPlayerState & { answeredCount: number } {
    return { ...state, answeredCount: state.answers.length };
  }

  private static toPlayerSummary(
    state: QuizPlayerState,
    uniPointsEarned: number,
  ): QuizPlayerSummary {
    return {
      userId: state.userId,
      displayName: state.displayName,
      totalScore: state.totalScore,
      correctCount: state.correctCount,
      totalCorrectTimeMs: state.totalCorrectTimeMs,
      uniPointsEarned,
      answers: state.answers,
    };
  }
}
