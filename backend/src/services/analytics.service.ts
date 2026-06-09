// ============================================================
// Analytics Service — MongoDB Aggregation Pipelines cho KPI
// ============================================================

import {
  UserModel,
  UserScoreModel,
  GameMatchLogModel,
  DailyAttemptModel,
  WeeklyEventParticipationModel,
  WeeklyEventResultModel,
} from '../models/index';
import type { AnalyticsOverview } from '@uniclub/shared';

export class AnalyticsService {
  /**
   * Tính toàn bộ KPI overview cho một khoảng thời gian.
   */
  static async getOverview(periodLabel: '7d' | '30d' | 'all'): Promise<AnalyticsOverview> {
    const now = new Date();
    let from: Date;

    switch (periodLabel) {
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        from = new Date(0); // epoch
        break;
    }

    const [participation, retention, completion, avgScores, avgTimes] = await Promise.all([
      this.getParticipationMetrics(from, now),
      this.getRetentionRate(),
      this.getCompletionRates(from, now),
      this.getAverageScores(from, now),
      this.getAverageTimes(from, now),
    ]);

    return {
      period: {
        from: from.toISOString(),
        to: now.toISOString(),
        label: periodLabel,
      },
      ...participation,
      ...retention,
      ...completion,
      ...avgScores,
      ...avgTimes,
    };
  }

  // ============================================================
  // Participation metrics
  // ============================================================

  private static async getParticipationMetrics(from: Date, to: Date) {
    const dateFilter = from.getTime() === 0 ? {} : { lastSeenAt: { $gte: from, $lte: to } };

    // Tổng HS đã truy cập UniClub (trong khoảng thời gian)
    const totalUniclubUsers = await UserModel.countDocuments(dateFilter);

    // Tổng HS đã chơi ít nhất 1 game
    const scoreFilter: any = { gamesPlayed: { $gt: 0 } };
    if (from.getTime() !== 0) {
      scoreFilter.lastPlayedAt = { $gte: from, $lte: to };
    }
    const totalGamePlayers = await UserScoreModel.countDocuments(scoreFilter);

    const participationRateGame =
      totalUniclubUsers > 0
        ? Math.round((totalGamePlayers / totalUniclubUsers) * 10000) / 100
        : 0;

    return { totalUniclubUsers, totalGamePlayers, participationRateGame };
  }

  // ============================================================
  // Retention rate (tuần)
  // ============================================================

  private static async getRetentionRate() {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay()); // Sunday
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);

    // Users active last week
    const usersLastWeek = await UserModel.countDocuments({
      lastSeenAt: { $gte: lastWeekStart, $lt: lastWeekEnd },
    });

    // Users from last week who are still active this week
    // (lastSeenAt >= thisWeekStart AND createdAt < thisWeekStart)
    const returningUsers = await UserModel.countDocuments({
      lastSeenAt: { $gte: thisWeekStart },
      createdAt: { $lt: thisWeekStart },
    });

    // New users this week
    const newUsersThisWeek = await UserModel.countDocuments({
      createdAt: { $gte: thisWeekStart },
    });

    // Retention = (users at end of week - new users) / users at start of week
    const usersEndOfWeek = returningUsers + newUsersThisWeek;
    const retentionRateWeekly =
      usersLastWeek > 0
        ? Math.round(((usersEndOfWeek - newUsersThisWeek) / usersLastWeek) * 10000) / 100
        : 0;

    return { retentionRateWeekly };
  }

  // ============================================================
  // Completion rates
  // ============================================================

  private static async getCompletionRates(from: Date, to: Date) {
    const dateFilter = from.getTime() === 0 ? {} : { playedAt: { $gte: from, $lte: to } };

    // Quiz Arena (So Tài)
    const [quizTotal, quizCompleted] = await Promise.all([
      GameMatchLogModel.countDocuments({ gameType: 'quiz_arena', ...dateFilter }),
      GameMatchLogModel.countDocuments({ gameType: 'quiz_arena', sessionCompleted: true, ...dateFilter }),
    ]);
    const completionRateQuizArena =
      quizTotal > 0 ? Math.round((quizCompleted / quizTotal) * 10000) / 100 : 0;

    // Mind Game (Đấu Trí) — gomoku + card_flip
    const [mindGameTotal, mindGameCompleted] = await Promise.all([
      GameMatchLogModel.countDocuments({ gameType: { $in: ['gomoku', 'card_flip'] }, ...dateFilter }),
      GameMatchLogModel.countDocuments({
        gameType: { $in: ['gomoku', 'card_flip'] },
        sessionCompleted: true,
        ...dateFilter,
      }),
    ]);
    const completionRateMindGame =
      mindGameTotal > 0 ? Math.round((mindGameCompleted / mindGameTotal) * 10000) / 100 : 0;

    // Boss Battle (Săn Boss)
    const dateFilterBoss =
      from.getTime() === 0 ? {} : { createdAt: { $gte: from, $lte: to } };
    
    // Tính tổng số attempts tối đa có thể tham gia dựa trên số lượng user tại từng ngày trong khoảng thời gian
    const userCreations = await UserModel.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let cumulative = 0;
    const cumulativeUsersByDate = new Map<string, number>();
    for (const item of userCreations) {
      cumulative += item.count;
      cumulativeUsersByDate.set(item._id, cumulative);
    }

    const getActiveUsersAtDateStr = (dateStr: string): number => {
      let lastVal = 0;
      for (const item of userCreations) {
        if (item._id <= dateStr) {
          lastVal = cumulativeUsersByDate.get(item._id) ?? 0;
        } else {
          break;
        }
      }
      return lastVal;
    };

    let startCalc = new Date(from);
    if (from.getTime() === 0) {
      if (userCreations.length > 0) {
        startCalc = new Date(userCreations[0]._id);
      } else {
        startCalc = new Date(to);
      }
    }
    startCalc.setHours(0, 0, 0, 0);
    const endCalc = new Date(to);
    endCalc.setHours(23, 59, 59, 999);

    let bossTotal = 0;
    const tempDate = new Date(startCalc);
    while (tempDate.getTime() <= endCalc.getTime()) {
      const dateStr = tempDate.toISOString().split('T')[0];
      bossTotal += getActiveUsersAtDateStr(dateStr);
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const bossCompleted = await DailyAttemptModel.countDocuments({ status: 'COMPLETED', ...dateFilterBoss });
    const completionRateBossBattle =
      bossTotal > 0 ? Math.round((bossCompleted / bossTotal) * 10000) / 100 : 0;

    // Weekly Event
    const dateFilterWE =
      from.getTime() === 0 ? {} : { createdAt: { $gte: from, $lte: to } };
    const [weParticipants, weSubmitted] = await Promise.all([
      WeeklyEventParticipationModel.countDocuments(dateFilterWE),
      WeeklyEventResultModel.countDocuments(dateFilterWE),
    ]);
    const completionRateWeeklyEvent =
      weParticipants > 0 ? Math.round((weSubmitted / weParticipants) * 10000) / 100 : 0;

    return {
      completionRateQuizArena,
      completionRateMindGame,
      completionRateBossBattle,
      completionRateWeeklyEvent,
    };
  }

  // ============================================================
  // Average scores
  // ============================================================

  private static async getAverageScores(from: Date, to: Date) {
    const dateFilter = from.getTime() === 0 ? {} : { playedAt: { $gte: from, $lte: to } };

    // Quiz Arena
    const quizScoreResult = await GameMatchLogModel.aggregate([
      { $match: { gameType: 'quiz_arena', ...dateFilter } },
      { $group: { _id: null, avgScore: { $avg: '$points' } } },
    ]);
    const avgScoreQuizArena = Math.round((quizScoreResult[0]?.avgScore ?? 0) * 100) / 100;

    // Mind Game (gomoku + card_flip)
    const mindGameScoreResult = await GameMatchLogModel.aggregate([
      { $match: { gameType: { $in: ['gomoku', 'card_flip'] }, ...dateFilter } },
      { $group: { _id: null, avgScore: { $avg: '$points' } } },
    ]);
    const avgScoreMindGame = Math.round((mindGameScoreResult[0]?.avgScore ?? 0) * 100) / 100;

    return { avgScoreQuizArena, avgScoreMindGame };
  }

  // ============================================================
  // Average times
  // ============================================================

  private static async getAverageTimes(from: Date, to: Date) {
    const dateFilter = from.getTime() === 0 ? {} : { playedAt: { $gte: from, $lte: to } };

    // Quiz Arena — chỉ tính trận hoàn thành
    const quizTimeResult = await GameMatchLogModel.aggregate([
      { $match: { gameType: 'quiz_arena', sessionCompleted: true, ...dateFilter } },
      { $group: { _id: null, avgTime: { $avg: '$playTimeSec' } } },
    ]);
    const avgTimeQuizArena = Math.round((quizTimeResult[0]?.avgTime ?? 0) * 100) / 100;

    // Mind Game — chỉ tính trận hoàn thành
    const mindGameTimeResult = await GameMatchLogModel.aggregate([
      { $match: { gameType: { $in: ['gomoku', 'card_flip'] }, sessionCompleted: true, ...dateFilter } },
      { $group: { _id: null, avgTime: { $avg: '$playTimeSec' } } },
    ]);
    const avgTimeMindGame = Math.round((mindGameTimeResult[0]?.avgTime ?? 0) * 100) / 100;

    return { avgTimeQuizArena, avgTimeMindGame };
  }
}
