// ============================================================
// Weekly Event — Grading Service
// Chấm điểm, tính leaderboard (FLOW-008, FLOW-009)
// ============================================================

import { redis } from '../../../config/index';
import {
  WeeklyEventModel,
  WeeklyEventResultModel,
  WeeklyEventParticipationModel,
  WeeklyEventLeaderboardSnapshotModel,
  WeeklyEventRoomModel,
  UserModel,
  ExamBankModel,
} from '../../../models/index';
import { ScoreService } from '../../../services/score.service';
import {
  WEEKLY_EVENT_REDIS_KEYS,
} from '@uniclub/shared';
import type {
  WeeklyEventResult,
  WeeklyEventAnswer,
  LeaderboardEntry,
  ExamBank,
} from '@uniclub/shared';
import { WeeklyEventAnswerService } from './weekly-event-answer.service';

export class WeeklyEventGradingService {
  /**
   * FLOW-008: Chấm điểm 1 học sinh.
   * Đối chiếu đáp án với exam, tính điểm, ghi kết quả, cập nhật sorted set.
   */
  static async gradeStudent(
    eventId: string,
    roomId: string,
    studentId: string,
    exam: ExamBank,
  ): Promise<WeeklyEventResult | null> {
    // 1. Lấy đáp án từ buffer
    const answers = await WeeklyEventAnswerService.getAnswers(eventId, studentId);
    if (Object.keys(answers).length === 0) {
      // Học sinh không trả lời câu nào
      return null;
    }

    // 2. Lấy participation để có thời gian
    const participation = await WeeklyEventParticipationModel.findOne({
      eventId,
      studentId,
    }).lean();
    if (!participation) return null;

    // 3. Đối chiếu đáp án
    const examQuestionMap = new Map(exam.questions.map((q) => [q.questionId, q]));
    const resultAnswers: WeeklyEventAnswer[] = [];
    let correctCount = 0;
    let totalTimeMs = 0;
    let lastCorrectAnswerAt: Date | null = null;

    for (const [questionId, answer] of Object.entries(answers)) {
      const question = examQuestionMap.get(questionId);
      const isCorrect = question ? answer.key === question.correctKey : false;

      const answeredAt = new Date(answer.at);
      resultAnswers.push({
        questionId,
        selectedKey: answer.key,
        isCorrect,
        answeredAt: answeredAt.toISOString(),
      });

      if (isCorrect) {
        correctCount++;
        if (!lastCorrectAnswerAt || answeredAt > lastCorrectAnswerAt) {
          lastCorrectAnswerAt = answeredAt;
        }
      }
    }

    // Tính tổng thời gian làm bài theo tổng thời gian phản hồi từng câu hỏi (Response Time Summation)
    const event = await WeeklyEventModel.findById(eventId).lean();
    const examDurationMs = (event?.examDuration || 20) * 60 * 1000;
    const questionCount = exam.questions.length;
    const perQuestionMs = examDurationMs / questionCount;

    const examStartedAt = participation.examStartedAt
      ? new Date(participation.examStartedAt).getTime()
      : new Date(participation.joinedAt).getTime();

    let computedTotalTimeMs = 0;
    for (let i = 0; i < questionCount; i++) {
      const q = exam.questions[i];
      const answer = answers[q.questionId];
      if (answer) {
        const questionStartAt = examStartedAt + i * perQuestionMs;
        const answeredAt = new Date(answer.at).getTime();
        let timeTaken = answeredAt - questionStartAt;
        
        // Clamping để đảm bảo tính chính xác
        if (timeTaken < 0) timeTaken = 0;
        if (timeTaken > perQuestionMs) timeTaken = perQuestionMs;
        
        computedTotalTimeMs += timeTaken;
      } else {
        // Học sinh không trả lời câu này -> Tính tối đa thời gian của câu đó (Phương án A)
        computedTotalTimeMs += perQuestionMs;
      }
    }
    totalTimeMs = computedTotalTimeMs;

    // 4. Tính điểm
    const score = correctCount * 10; // Base score: 10 điểm/câu đúng

    // 5. Ghi kết quả vào MongoDB
    const result = await WeeklyEventResultModel.create({
      participationId: participation._id,
      eventId,
      roomId,
      studentId,
      correctCount,
      totalAnswered: Object.keys(answers).length,
      totalTimeMs,
      lastCorrectAnswerAt,
      score,
      answers: resultAnswers,
    });

    // 6. Cập nhật sorted set (DATA-R-002)
    const lbKey = `${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${participation.grade}`;
    const compositeScore = this.computeCompositeScore(correctCount, totalTimeMs, lastCorrectAnswerAt);
    await redis.zadd(lbKey, compositeScore, studentId);

    // 7. Cập nhật UserScore
    await ScoreService.addWinPoints(studentId, score, 'weekly_event');

    // 8. Xóa buffer đáp án
    await WeeklyEventAnswerService.clearAnswers(eventId, studentId);

    return this.toResult(result);
  }

  /**
   * FLOW-008: Chấm điểm hàng loạt (batch grading).
   */
  static async gradeAllStudents(
    eventId: string,
    roomId: string,
    grade: number,
    exam: ExamBank,
  ): Promise<number> {
    const participations = await WeeklyEventParticipationModel.find({
      eventId,
      grade,
    }).lean();

    if (participations.length === 0) return 0;

    // 1. Pipeline lấy toàn bộ answers của các học sinh từ Redis
    const pipeline = redis.pipeline();
    for (const p of participations) {
      const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${p.studentId}`;
      pipeline.hgetall(answersKey);
    }
    const rawAnswersList = (await pipeline.exec()) || [];

    // 2. Query event parameters (examDuration)
    const event = await WeeklyEventModel.findById(eventId).lean();
    const examDurationMs = (event?.examDuration || 20) * 60 * 1000;
    const questionCount = exam.questions.length;
    const perQuestionMs = examDurationMs / questionCount;
    const examQuestionMap = new Map(exam.questions.map((q) => [q.questionId, q]));

    const resultsToInsert: any[] = [];
    const zaddArgs: (string | number)[] = [];
    const scoreUpdates: Array<{ userId: string; points: number; gameType: 'weekly_event' }> = [];
    const studentsToClear: string[] = [];

    // Đọc số lần disconnect của học sinh từ Redis
    const disconnectPipeline = redis.pipeline();
    for (const p of participations) {
      disconnectPipeline.get(`we:disconnect_count:${eventId}:${p.studentId}`);
    }
    const rawDisconnects = (await disconnectPipeline.exec()) || [];

    // 3. Chấm điểm trên RAM
    for (let i = 0; i < participations.length; i++) {
      const p = participations[i];
      const rawAnswers = rawAnswersList[i]?.[1] as Record<string, string> || {};
      const disconnectCountVal = rawDisconnects[i]?.[1] as string || '0';
      const disconnectCount = parseInt(disconnectCountVal, 10) || 0;

      const answers: Record<string, { key: string; at: number }> = {};
      for (const [qId, data] of Object.entries(rawAnswers)) {
        try {
          answers[qId] = JSON.parse(data);
        } catch {}
      }

      if (Object.keys(answers).length === 0) {
        continue;
      }

      const resultAnswers: WeeklyEventAnswer[] = [];
      let correctCount = 0;
      let lastCorrectAnswerAt: Date | null = null;

      for (const [questionId, answer] of Object.entries(answers)) {
        const question = examQuestionMap.get(questionId);
        const isCorrect = question ? answer.key === question.correctKey : false;
        const answeredAt = new Date(answer.at);

        resultAnswers.push({
          questionId,
          selectedKey: answer.key,
          isCorrect,
          answeredAt: answeredAt.toISOString(),
        });

        if (isCorrect) {
          correctCount++;
          if (!lastCorrectAnswerAt || answeredAt > lastCorrectAnswerAt) {
            lastCorrectAnswerAt = answeredAt;
          }
        }
      }

      const examStartedAt = p.examStartedAt
        ? new Date(p.examStartedAt).getTime()
        : new Date(p.joinedAt).getTime();

      let computedTotalTimeMs = 0;
      for (let j = 0; j < questionCount; j++) {
        const q = exam.questions[j];
        const answer = answers[q.questionId];
        if (answer) {
          const questionStartAt = examStartedAt + j * perQuestionMs;
          const answeredAt = new Date(answer.at).getTime();
          let timeTaken = answeredAt - questionStartAt;
          if (timeTaken < 0) timeTaken = 0;
          if (timeTaken > perQuestionMs) timeTaken = perQuestionMs;
          computedTotalTimeMs += timeTaken;
        } else {
          computedTotalTimeMs += perQuestionMs;
        }
      }

      const score = correctCount * 10;

      resultsToInsert.push({
        participationId: p._id,
        eventId,
        roomId,
        studentId: p.studentId,
        correctCount,
        totalAnswered: Object.keys(answers).length,
        totalTimeMs: computedTotalTimeMs,
        lastCorrectAnswerAt,
        score,
        answers: resultAnswers,
      });

      const compositeScore = this.computeCompositeScore(correctCount, computedTotalTimeMs, lastCorrectAnswerAt);
      zaddArgs.push(compositeScore, p.studentId);

      scoreUpdates.push({
        userId: p.studentId,
        points: score,
        gameType: 'weekly_event',
      });

      studentsToClear.push(p.studentId);

      // Đồng bộ disconnectCount từ Redis ngược lại MongoDB
      if (disconnectCount > 0) {
        WeeklyEventParticipationModel.updateOne(
          { _id: p._id },
          { $set: { disconnectCount } }
        ).catch((err) => console.error('[WeeklyEvent] Sync disconnectCount error:', err));
      }
    }

    // 4. Ghi DB & Redis theo chunks (size: 500)
    const chunkSize = 500;
    for (let i = 0; i < resultsToInsert.length; i += chunkSize) {
      const resultsChunk = resultsToInsert.slice(i, i + chunkSize);
      const scoreUpdatesChunk = scoreUpdates.slice(i, i + chunkSize);
      const clearAnswersChunk = studentsToClear.slice(i, i + chunkSize);
      const zaddChunk = zaddArgs.slice(i * 2, (i + chunkSize) * 2);

      if (resultsChunk.length > 0) {
        await WeeklyEventResultModel.insertMany(resultsChunk);
      }

      if (zaddChunk.length > 0) {
        const lbKey = `${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${grade}`;
        await redis.zadd(lbKey, ...zaddChunk);
      }

      if (scoreUpdatesChunk.length > 0) {
        await ScoreService.addWinPointsBatch(scoreUpdatesChunk);
      }

      // Pipeline lưu cache và xóa answers tạm trên Redis
      const cachePipeline = redis.pipeline();
      for (const res of resultsChunk) {
        const cacheKey = `we:personal_result:${eventId}:${res.studentId}`;
        cachePipeline.set(cacheKey, JSON.stringify(res), 'EX', 3600);
      }
      for (const studentId of clearAnswersChunk) {
        const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${studentId}`;
        cachePipeline.del(answersKey);
        cachePipeline.del(`we:disconnect_count:${eventId}:${studentId}`);
      }
      await cachePipeline.exec();
    }

    return resultsToInsert.length;
  }

  /**
   * FLOW-009: Tính leaderboard snapshot.
   * ZREVRANGE top N, JOIN user info, ghi snapshot, cập nhật rank.
   */
  static async calculateLeaderboard(
    eventId: string,
    roomId: string,
    grade: number,
    topN: number,
  ): Promise<LeaderboardEntry[]> {
    const lbKey = `${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${grade}`;

    // Lấy top N từ sorted set
    const topEntries = await redis.zrevrange(lbKey, 0, topN - 1, 'WITHSCORES');
    const topStudentIds: string[] = [];
    for (let i = 0; i < topEntries.length; i += 2) {
      topStudentIds.push(topEntries[i]);
    }

    if (topStudentIds.length === 0) return [];

    // JOIN với UserModel để lấy displayName, avatar
    const users = await UserModel.find({ userId: { $in: topStudentIds } }).lean();
    const userMap = new Map(users.map((u) => [u.userId, u]));

    // Lấy kết quả từ MongoDB
    const results = await WeeklyEventResultModel.find({
      eventId,
      studentId: { $in: topStudentIds },
    }).lean();
    const resultMap = new Map(results.map((r) => [r.studentId, r]));

    const topNList: LeaderboardEntry[] = topStudentIds.map((studentId, idx) => {
      const user = userMap.get(studentId);
      const result = resultMap.get(studentId);
      return {
        rank: idx + 1,
        studentId,
        displayName: user?.name || studentId,
        avatarUrl: user?.avatar,
        correctCount: result?.correctCount || 0,
        totalTimeMs: result?.totalTimeMs || 0,
      };
    });

    // Ghi snapshot (DATA-M-007)
    await WeeklyEventLeaderboardSnapshotModel.findOneAndUpdate(
      { eventId, roomId },
      {
        eventId,
        roomId,
        grade,
        topN: topNList,
        computedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Cập nhật rank vào tất cả kết quả MongoDB (CHẠY BẤT ĐỒNG BỘ Ở BACKGROUND)
    WeeklyEventResultModel.find({ eventId, roomId })
      .sort({ score: -1, totalTimeMs: 1 })
      .lean()
      .then((allResults) => {
        const bulkOps = allResults.map((r, idx) => ({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { rank: idx + 1 } },
          },
        }));

        if (bulkOps.length > 0) {
          WeeklyEventResultModel.bulkWrite(bulkOps).catch((err) =>
            console.error('[WeeklyEvent] Async rank update failed:', err)
          );
        }
      })
      .catch((err) => console.error('[WeeklyEvent] Fetch results for rank failed:', err));

    return topNList;
  }

  /**
   * Tính composite score cho sorted set.
   * Formula: correctCount * 1e10 - totalTimeMs * 1e3 - lastCorrectTimestamp/1000
   * → cao hơn = hạng tốt hơn
   */
  static computeCompositeScore(
    correctCount: number,
    totalTimeMs: number,
    lastCorrectAnswerAt: Date | null,
  ): number {
    const lastCorrectTs = lastCorrectAnswerAt ? lastCorrectAnswerAt.getTime() : 0;
    return correctCount * 1e10 - totalTimeMs * 1e3 - lastCorrectTs / 1000;
  }

  /**
   * Lấy kết quả cá nhân của học sinh.
   */
  static async getPersonalResult(
    eventId: string,
    studentId: string,
    grade?: number,
  ): Promise<WeeklyEventResult | null> {
    const cacheKey = `we:personal_result:${eventId}:${studentId}`;
    const cached = await redis.get(cacheKey);
    
    let result: WeeklyEventResult | null = null;
    if (cached) {
      result = JSON.parse(cached);
    } else {
      const doc = await WeeklyEventResultModel.findOne({ eventId, studentId }).lean();
      if (doc) {
        result = this.toResult(doc);
        // Lưu lại cache
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
      }
    }

    if (result) {
      let finalGrade = grade;
      if (!finalGrade) {
        const participation = await WeeklyEventParticipationModel.findOne({ eventId, studentId }).lean();
        finalGrade = participation?.grade;
      }

      if (finalGrade) {
        // Tính toán rank real-time từ Redis sorted set
        const lbKey = `${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${finalGrade}`;
        const redisRank = await redis.zrevrank(lbKey, studentId);
        result.rank = redisRank !== null ? redisRank + 1 : undefined;
      }
    }

    return result;
  }

  /**
   * Lấy leaderboard snapshot.
   */
  static async getLeaderboardSnapshot(
    eventId: string,
    roomId: string,
  ): Promise<LeaderboardEntry[] | null> {
    const doc = await WeeklyEventLeaderboardSnapshotModel.findOne({
      eventId,
      roomId,
    }).lean();
    return doc?.topN || null;
  }

  // ---- Helpers ----

  private static toResult(doc: any): WeeklyEventResult {
    return {
      _id: String(doc._id),
      participationId: String(doc.participationId),
      eventId: String(doc.eventId),
      roomId: String(doc.roomId),
      studentId: doc.studentId as string,
      correctCount: doc.correctCount as number,
      totalAnswered: doc.totalAnswered as number,
      totalTimeMs: doc.totalTimeMs as number,
      lastCorrectAnswerAt: doc.lastCorrectAnswerAt?.toISOString(),
      rank: doc.rank as number | undefined,
      score: doc.score as number,
      answers: (doc.answers as WeeklyEventAnswer[]) || [],
    };
  }
}
