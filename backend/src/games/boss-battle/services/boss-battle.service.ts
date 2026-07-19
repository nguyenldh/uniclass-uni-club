// ============================================================
// Boss Battle — Core Gameplay Service
// FLW-03 (lobby), FLW-04 (start), FLW-05 (answer), FLW-06 (complete)
// ============================================================

import mongoose from 'mongoose';
import { redis } from '../../../config/index';
import {
  BossInstanceModel,
  StudentBossProgressModel,
  DailyAttemptModel,
  BossQuestionSetModel,
  BossAnswerRecordModel,
  UserModel,
} from '../../../models/index';
import {
  BOSS_BATTLE_REDIS_KEYS,
  BOSS_BATTLE_SOCKET_EVENTS,
  BOSS_BATTLE_ROOM_PREFIX,
} from '@uniclub/shared';
import type {
  BossInstance,
  BossLobbyResponse,
  BossBattleStartResponse,
  BossAnswerResponse,
  BossDailyResultResponse,
  BossQuestionPublic,
  StudentBossProgress,
  DailyAttempt as DailyAttemptDto,
} from '@uniclub/shared';
import { BossQuestionService } from './boss-question.service';
import { LeaderboardService } from './leaderboard.service';
import { GameResultEventService } from '../../../services/game-result-event.service';
import { formatWeekKey, formatDateKey, getDayIndex, getNextWeeklyResetAt } from '../utils/week';
import { getIO } from '../../../sockets/index';

const ATTEMPT_TTL_SEC = 60 * 60 * 24; // 24h

function questionStartedKey(attemptId: string, questionId: string): string {
  return `${BOSS_BATTLE_REDIS_KEYS.ATTEMPT_QUESTION_STARTED}:${attemptId}:${questionId}`;
}

function bossInstanceDto(doc: any): BossInstance {
  return {
    id: String(doc._id),
    weekKey: doc.weekKey,
    gradeLevel: doc.gradeLevel,
    config: doc.config,
    totalPointsEarned: doc.totalPointsEarned,
    progressPercent: doc.progressPercent,
    currentBossStateImg: doc.currentBossStateImg,
    status: doc.status,
    createdAt: doc.createdAt,
    defeatedAt: doc.defeatedAt,
    closedAt: doc.closedAt,
  };
}

function progressDto(doc: any): StudentBossProgress {
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    bossInstanceId: String(doc.bossInstanceId),
    weekKey: doc.weekKey,
    gradeLevel: doc.gradeLevel,
    correctCountWeek: doc.correctCountWeek,
    totalCorrectTimeSec: doc.totalCorrectTimeSec,
    lastAchievedAt: doc.lastAchievedAt,
    pointsContributedWeek: doc.pointsContributedWeek,
  };
}

function attemptDto(doc: any): DailyAttemptDto {
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    bossInstanceId: String(doc.bossInstanceId),
    dateKey: doc.dateKey,
    dayIndex: doc.dayIndex,
    questionSetId: String(doc.questionSetId),
    status: doc.status,
    correctCount: doc.correctCount,
    totalResponseTime: doc.totalResponseTime,
    correctResponseTime: doc.correctResponseTime ?? 0,
    pointsEarned: doc.pointsEarned,
    currentQuestionIndex: doc.currentQuestionIndex,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
  };
}

export function pickBossImage(config: any, progressPercent: number): string {
  const hpRemainPercent = Math.max(0, 100 - progressPercent);
  const state = config.bossStates.find(
    (s: any) => hpRemainPercent >= s.minPercent && hpRemainPercent <= s.maxPercent,
  );
  return state?.img ?? config.bossStates[0]?.img ?? '';
}

export class BossBattleService {
  /** FLW-03: GET /lobby */
  static async getLobby(studentId: string, gradeLevel: number): Promise<BossLobbyResponse> {
    const weekKey = formatWeekKey();
    const dateKey = formatDateKey();
    const weeklyResetAt = getNextWeeklyResetAt();

    const instance = await BossInstanceModel.findOne({ weekKey, gradeLevel }).lean();
    if (!instance) {
      return {
        hasBoss: false,
        boss: null,
        dailyAnswered: 0,
        dailyRemaining: 0,
        dailyStatus: null,
        weeklyResetAt,
        myProgress: null,
      };
    }

    const questionsPerDay = instance.config.questionsPerDay;

    const [attempt, progress] = await Promise.all([
      DailyAttemptModel.findOne({ studentId, bossInstanceId: instance._id, dateKey }).lean(),
      StudentBossProgressModel.findOne({ studentId, weekKey }).lean(),
    ]);

    const dailyAnswered = attempt?.correctCount !== undefined ? attempt.currentQuestionIndex : 0;
    const dailyRemaining = Math.max(0, questionsPerDay - dailyAnswered);

    return {
      hasBoss: true,
      boss: bossInstanceDto(instance),
      dailyAnswered,
      dailyRemaining,
      dailyStatus: attempt?.status ?? null,
      weeklyResetAt,
      myProgress: progress ? progressDto(progress) : null,
    };
  }

  /** FLW-04: POST /battle/start — tạo hoặc resume DailyAttempt hôm nay */
  static async startBattle(
    studentId: string,
    gradeLevel: number,
  ): Promise<BossBattleStartResponse> {
    const weekKey = formatWeekKey();
    const dateKey = formatDateKey();
    const dayIndex = getDayIndex();

    const instance = await BossInstanceModel.findOne({ weekKey, gradeLevel });
    if (!instance) throw new Error('No Boss instance for current week');
    if (instance.status === 'CLOSED') throw new Error('Tuần đã đóng — không thể tiếp tục chiến đấu');
    if (instance.status !== 'ACTIVE') throw new Error('Boss already defeated or closed');

    // Check existing attempt
    const existing = await DailyAttemptModel.findOne({
      studentId,
      bossInstanceId: instance._id,
      dateKey,
    });

    if (existing?.status === 'COMPLETED') {
      throw new Error('Daily attempt already completed for today');
    }

    // Lấy questionSet hôm nay
    const set = await BossQuestionSetModel.findOne({
      weekKey,
      gradeLevel,
      dayIndex,
    });
    if (!set || set.questionIds.length === 0) {
      throw new Error('Question set not configured for today');
    }

    let attempt = existing;
    if (!attempt) {
      try {
        attempt = await DailyAttemptModel.create({
          studentId,
          bossInstanceId: instance._id,
          dateKey,
          dayIndex,
          questionSetId: set._id,
          status: 'IN_PROGRESS',
          correctCount: 0,
          totalResponseTime: 0,
          correctResponseTime: 0,
          pointsEarned: 0,
          currentQuestionIndex: 0,
          startedAt: new Date(),
          completedAt: null,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          attempt = await DailyAttemptModel.findOne({
            studentId,
            bossInstanceId: instance._id,
            dateKey,
          });
        } else throw err;
      }
    }

    if (!attempt) throw new Error('Failed to create attempt');

    // Load questions theo thứ tự
    const questions = await BossQuestionService.getByIds(set.questionIds.map((id) => String(id)));
    const tMaxSec = instance.config.tMaxSec;
    const totalQuestions = questions.length;

    const publicQuestions: BossQuestionPublic[] = questions.map((q, idx) => ({
      id: q.id,
      grade: q.grade,
      content: q.content,
      imageUrl: q.imageUrl,
      options: q.options,
      questionIndex: idx,
      totalQuestions,
      tMaxSec,
    }));

    // Set currentQuestionStartedAt cho câu hiện tại
    const currentQuestion = publicQuestions[attempt.currentQuestionIndex];
    const serverStartedAt = Date.now();
    if (currentQuestion) {
      await redis.set(
        questionStartedKey(String(attempt._id), currentQuestion.id),
        String(serverStartedAt),
        'EX',
        ATTEMPT_TTL_SEC,
      );
    }

    return {
      attemptId: String(attempt._id),
      questions: publicQuestions,
      serverStartedAt,
      currentQuestionIndex: attempt.currentQuestionIndex,
      pointsEarned: attempt.pointsEarned,
    };
  }

  /** FLW-05: POST /battle/answer */
  static async submitAnswer(params: {
    studentId: string;
    attemptId: string;
    questionId: string;
    selectedIndex: number | null;
  }): Promise<BossAnswerResponse> {
    const { studentId, attemptId, questionId, selectedIndex } = params;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new Error('Invalid attemptId');
    }

    const attempt = await DailyAttemptModel.findById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    if (attempt.studentId !== studentId) throw new Error('Not your attempt');
    if (attempt.status !== 'IN_PROGRESS') throw new Error('Attempt not in progress');

    const instance = await BossInstanceModel.findById(attempt.bossInstanceId);
    if (!instance) throw new Error('Boss instance not found');

    const set = await BossQuestionSetModel.findById(attempt.questionSetId);
    if (!set) throw new Error('Question set not found');

    const idx = set.questionIds.findIndex((id) => String(id) === questionId);
    if (idx < 0) throw new Error('Question not in attempt set');
    if (idx !== attempt.currentQuestionIndex) {
      throw new Error(`Question out of order (expected idx=${attempt.currentQuestionIndex})`);
    }

    const question = await BossQuestionService.getById(questionId);
    if (!question) throw new Error('Question not found');

    const { basePoint, maxSpeedBonus, tMaxSec } = instance.config;

    // Tính responseTimeSec từ Redis (chống cheat)
    const startedKey = questionStartedKey(attemptId, questionId);
    const startedAtStr = await redis.get(startedKey);
    const now = Date.now();
    const startedAt = startedAtStr ? parseInt(startedAtStr, 10) : now;
    let responseTimeSec = (now - startedAt) / 1000;
    responseTimeSec = Math.min(Math.max(responseTimeSec, 0), tMaxSec);

    const isCorrect = selectedIndex !== null && selectedIndex === question.correctIndex;
    let pointsAwarded = 0;
    if (isCorrect) {
      const speedBonus = maxSpeedBonus * Math.max(0, 1 - responseTimeSec / tMaxSec);
      pointsAwarded = Math.round(basePoint + speedBonus);
    }

    // Ghi BossAnswerRecord
    await BossAnswerRecordModel.create({
      dailyAttemptId: attempt._id,
      questionId: new mongoose.Types.ObjectId(questionId),
      selectedIndex,
      isCorrect,
      responseTimeSec,
      pointsAwarded,
      answeredAt: new Date(),
    });

    // Cập nhật attempt
    attempt.correctCount += isCorrect ? 1 : 0;
    attempt.totalResponseTime += responseTimeSec;
    // Thời gian chỉ tính câu ĐÚNG (đồng bộ định nghĩa với tiêu chí thời gian ở BXH).
    // Dùng `|| 0` để an toàn với lượt cũ chưa có field (tránh NaN).
    attempt.correctResponseTime = (attempt.correctResponseTime || 0) + (isCorrect ? responseTimeSec : 0);
    attempt.pointsEarned += pointsAwarded;
    attempt.currentQuestionIndex += 1;

    const totalQuestions = set.questionIds.length;
    const attemptCompleted = attempt.currentQuestionIndex >= totalQuestions;
    if (attemptCompleted) {
      attempt.status = 'COMPLETED';
      attempt.completedAt = new Date();
    }
    await attempt.save();

    await redis.del(startedKey);

    // Set timer cho câu kế tiếp
    let nextQuestionIndex: number | null = null;
    if (!attemptCompleted) {
      nextQuestionIndex = attempt.currentQuestionIndex;
      const nextQId = String(set.questionIds[nextQuestionIndex]);
      await redis.set(
        questionStartedKey(attemptId, nextQId),
        String(Date.now()),
        'EX',
        ATTEMPT_TTL_SEC,
      );
    } else {
      // Hoàn thành lượt → cộng dồn progress + boss HP + broadcast
      await this.finalizeAttempt(attempt._id as mongoose.Types.ObjectId);
    }

    return {
      isCorrect,
      correctIndex: question.correctIndex,
      responseTimeSec,
      pointsAwarded,
      nextQuestionIndex,
      attemptCompleted,
    };
  }

  /** FLW-06: tổng kết khi attempt complete (gọi nội bộ từ submitAnswer) */
  private static async finalizeAttempt(attemptId: mongoose.Types.ObjectId): Promise<void> {
    const attempt = await DailyAttemptModel.findById(attemptId);
    if (!attempt) return;

    const instance = await BossInstanceModel.findById(attempt.bossInstanceId);
    if (!instance) return;

    // Tổng thời gian các câu đúng (cho tiêu chí xếp hạng)
    const correctRecords = await BossAnswerRecordModel.find({
      dailyAttemptId: attempt._id,
      isCorrect: true,
    }).lean();
    const correctTimeSec = correctRecords.reduce((s, r: any) => s + r.responseTimeSec, 0);

    // Upsert StudentBossProgress
    const progress = await StudentBossProgressModel.findOneAndUpdate(
      { studentId: attempt.studentId, weekKey: instance.weekKey },
      {
        $setOnInsert: {
          bossInstanceId: instance._id,
          gradeLevel: instance.gradeLevel,
        },
        $inc: {
          correctCountWeek: attempt.correctCount,
          totalCorrectTimeSec: correctTimeSec,
          pointsContributedWeek: attempt.pointsEarned,
        },
        $set: {
          lastAchievedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Cập nhật Boss HP
    const newTotal = instance.totalPointsEarned + attempt.pointsEarned;
    const progressPercent = Math.min(100, (newTotal / instance.config.hpMax) * 100);
    const newImg = pickBossImage(instance.config, progressPercent);
    const willDefeat = progressPercent >= 100 && instance.status === 'ACTIVE';

    instance.totalPointsEarned = newTotal;
    instance.progressPercent = progressPercent;
    instance.currentBossStateImg = newImg;
    if (willDefeat) {
      instance.status = 'DEFEATED';
      instance.defeatedAt = new Date();
    }
    await instance.save();

    // Emit Kafka (fire-and-forget)
    GameResultEventService.emitBossBattleResult(attempt, progress, instance).catch((err) => {
      console.error('[BossBattle] emit kafka failed:', err);
    });

    // Broadcast Boss HP
    try {
      const io = getIO();
      const room = `${BOSS_BATTLE_ROOM_PREFIX}:${instance.weekKey}:${instance.gradeLevel}`;
      // Fetch player name for hit notification
      const hitUser = await UserModel.findOne({ userId: attempt.studentId }).select('name').lean();
      const hitByName = hitUser?.name ?? 'Học sinh';
      const hpPayload = {
        weekKey: instance.weekKey,
        gradeLevel: instance.gradeLevel,
        totalPointsEarned: instance.totalPointsEarned,
        progressPercent: instance.progressPercent,
        currentBossStateImg: instance.currentBossStateImg,
        status: instance.status,
        // Hit notification data
        hitBy: attempt.studentId,
        hitByName,
        hitPoints: attempt.pointsEarned,
      };
      console.log('[BossBattle] Emitting hp-update to room:', room, 'payload:', JSON.stringify(hpPayload));
      io.to(room).emit(BOSS_BATTLE_SOCKET_EVENTS.BOSS_HP_UPDATE, hpPayload);
      if (willDefeat) {
        io.to(room).emit(BOSS_BATTLE_SOCKET_EVENTS.BOSS_DEFEATED, {
          weekKey: instance.weekKey,
          gradeLevel: instance.gradeLevel,
          defeatedAt: instance.defeatedAt,
        });
      }
    } catch (err) {
      console.warn('[BossBattle] socket broadcast skipped:', err);
    }

    // Recompute + broadcast BXH
    LeaderboardService.invalidateAndBroadcast(instance.weekKey, instance.gradeLevel).catch(
      (err) => console.error('[BossBattle] BXH broadcast failed:', err),
    );
  }

  /** GET /attempt/:id/result — FLW-06 */
  static async getAttemptResult(
    studentId: string,
    attemptId: string,
  ): Promise<BossDailyResultResponse> {
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new Error('Invalid attemptId');
    }
    const attempt = await DailyAttemptModel.findById(attemptId).lean();
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentId) throw new Error('Not your attempt');

    const instance = await BossInstanceModel.findById(attempt.bossInstanceId).lean();
    if (!instance) throw new Error('Boss instance not found');

    const progress = await StudentBossProgressModel.findOne({
      studentId,
      weekKey: instance.weekKey,
    }).lean();

    return {
      attempt: attemptDto(attempt),
      boss: bossInstanceDto(instance),
      myProgress: progress
        ? progressDto(progress)
        : {
          id: '',
          studentId,
          bossInstanceId: String(instance._id),
          weekKey: instance.weekKey,
          gradeLevel: instance.gradeLevel,
          correctCountWeek: 0,
          totalCorrectTimeSec: 0,
          lastAchievedAt: null,
          pointsContributedWeek: 0,
        },
    };
  }

  /** Monitor: tổng quan instance + counts */
  static async getInstanceMonitor(
    weekKey?: string,
  ): Promise<
    Array<{
      instance: BossInstance;
      participantCount: number;
      completedAttemptCount: number;
    }>
  > {
    const filter: Record<string, unknown> = {};
    if (weekKey) filter.weekKey = weekKey;
    const instances = await BossInstanceModel.find(filter).sort({ weekKey: -1, gradeLevel: 1 }).lean();

    const result: Array<{
      instance: BossInstance;
      participantCount: number;
      completedAttemptCount: number;
    }> = [];

    for (const ins of instances) {
      const [participantCount, completedAttemptCount] = await Promise.all([
        StudentBossProgressModel.countDocuments({ weekKey: ins.weekKey, gradeLevel: ins.gradeLevel }),
        DailyAttemptModel.countDocuments({
          bossInstanceId: ins._id,
          status: 'COMPLETED',
        }),
      ]);
      result.push({
        instance: bossInstanceDto(ins),
        participantCount,
        completedAttemptCount,
      });
    }
    return result;
  }
}
