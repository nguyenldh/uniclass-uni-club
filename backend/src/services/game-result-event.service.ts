// ============================================================
// Game Result Event Service — Map & emit kết quả game sang Kafka
// ============================================================

import { KafkaProducerService } from './kafka-producer.service';
import { GameMatchLogModel } from '../models/index';
import type {
  ClubGameResultDto,
  KafkaGameType,
  CardFlipSession,
  GomokuSession,
  QuizArenaSession,
  QuizArenaResult,
} from '@uniclub/shared';
import { GAME_TYPE_TO_KAFKA } from '@uniclub/shared';

/**
 * Tính play time từ startedAt và endedAt (giây).
 */
function calculatePlayTime(startedAt: Date, endedAt?: Date): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.round((end - start) / 1000);
}

export class GameResultEventService {
  /**
   * Emit kết quả Quiz Arena (So Tài) cho cả 2 người chơi.
   * Gọi sau khi endMatch() hoàn tất.
   */
  static async emitQuizArenaResult(session: QuizArenaSession, result: QuizArenaResult): Promise<void> {
    const playTime = calculatePlayTime(session.startedAt, session.endedAt);
    const totalQuestions = session.questions.length;

    // Emit cho playerA (luôn là người thật)
    const playerAResult: ClubGameResultDto = {
      profileId: session.playerA,
      gameType: GAME_TYPE_TO_KAFKA['quiz_arena'] as KafkaGameType,
      point: result.playerA.uniPointsEarned,
      playTime: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: session.winner === session.playerA,
      correctCount: session.playerAState.correctCount,
      totalQuestions: totalQuestions,
    };
    await KafkaProducerService.sendGameResult(playerAResult);
    // Persist cho analytics
    GameMatchLogModel.create({
      userId: session.playerA,
      gameType: 'quiz_arena',
      playTimeSec: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: session.winner === session.playerA,
      points: result.playerA.uniPointsEarned,
      correctCount: session.playerAState.correctCount,
      totalQuestions: totalQuestions,
      playedAt: new Date(),
    }).catch((err: Error) => console.error('[Analytics] Failed to log quiz_arena match:', err.message));

    // Emit cho playerB nếu không phải bot
    if (!session.isBot && session.playerB !== 'BOT') {
      const playerBResult: ClubGameResultDto = {
        profileId: session.playerB,
        gameType: GAME_TYPE_TO_KAFKA['quiz_arena'] as KafkaGameType,
        point: result.playerB.uniPointsEarned,
        playTime: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: session.winner === session.playerB,
        correctCount: session.playerBState.correctCount,
        totalQuestions: totalQuestions,
      };
      await KafkaProducerService.sendGameResult(playerBResult);
      GameMatchLogModel.create({
        userId: session.playerB,
        gameType: 'quiz_arena',
        playTimeSec: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: session.winner === session.playerB,
        points: result.playerB.uniPointsEarned,
        correctCount: session.playerBState.correctCount,
        totalQuestions: totalQuestions,
        playedAt: new Date(),
      }).catch((err: Error) => console.error('[Analytics] Failed to log quiz_arena match:', err.message));
    }
  }

  /**
   * Emit kết quả Gomoku (Caro) cho cả 2 người chơi.
   * Gọi sau khi game kết thúc (có winner hoặc draw).
   */
  static async emitGomokuResult(
    session: GomokuSession,
    winnerId?: string,
    isDraw: boolean = false,
  ): Promise<void> {
    const playTime = calculatePlayTime(session.startedAt, session.endedAt);
    const winPoints = session.config.winPoints;

    // Emit cho playerX (luôn là người thật)
    const playerXResult: ClubGameResultDto = {
      profileId: session.playerX,
      gameType: GAME_TYPE_TO_KAFKA['gomoku'] as KafkaGameType,
      point: winnerId === session.playerX ? winPoints : 0,
      playTime: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: winnerId === session.playerX,
    };
    await KafkaProducerService.sendGameResult(playerXResult);
    GameMatchLogModel.create({
      userId: session.playerX,
      gameType: 'gomoku',
      playTimeSec: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: winnerId === session.playerX,
      points: winnerId === session.playerX ? winPoints : 0,
      playedAt: new Date(),
    }).catch((err: Error) => console.error('[Analytics] Failed to log gomoku match:', err.message));

    // Emit cho playerO nếu không phải AI
    if (!session.isAI && session.playerO !== 'AI') {
      const playerOResult: ClubGameResultDto = {
        profileId: session.playerO,
        gameType: GAME_TYPE_TO_KAFKA['gomoku'] as KafkaGameType,
        point: winnerId === session.playerO ? winPoints : 0,
        playTime: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: winnerId === session.playerO,
      };
      await KafkaProducerService.sendGameResult(playerOResult);
      GameMatchLogModel.create({
        userId: session.playerO,
        gameType: 'gomoku',
        playTimeSec: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: winnerId === session.playerO,
        points: winnerId === session.playerO ? winPoints : 0,
        playedAt: new Date(),
      }).catch((err: Error) => console.error('[Analytics] Failed to log gomoku match:', err.message));
    }
  }

  /**
   * Emit kết quả Card Flip (Lật mảnh ghép) cho cả 2 người chơi.
   * Gọi sau khi game kết thúc.
   */
  static async emitCardFlipResult(
    session: CardFlipSession,
    winnerId?: string,
    isDraw: boolean = false,
  ): Promise<void> {
    const playTime = calculatePlayTime(session.startedAt, session.endedAt);
    const durationSeconds = playTime; // duration = total play time for Card Flip
    const winPoints = session.config.winPoints;

    // Emit cho playerA (luôn là người thật)
    const playerAResult: ClubGameResultDto = {
      profileId: session.playerA,
      gameType: GAME_TYPE_TO_KAFKA['card_flip'] as KafkaGameType,
      point: winnerId === session.playerA ? winPoints : 0,
      playTime: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: winnerId === session.playerA,
      durationSeconds: durationSeconds,
      consecutivePairs: session.maxConsecutivePairsA,
    };
    await KafkaProducerService.sendGameResult(playerAResult);
    GameMatchLogModel.create({
      userId: session.playerA,
      gameType: 'card_flip',
      playTimeSec: playTime,
      sessionCompleted: session.status === 'finished',
      isWin: winnerId === session.playerA,
      points: winnerId === session.playerA ? winPoints : 0,
      playedAt: new Date(),
    }).catch((err: Error) => console.error('[Analytics] Failed to log card_flip match:', err.message));

    // Emit cho playerB nếu không phải AI
    if (!session.isAI && session.playerB !== 'AI') {
      const playerBResult: ClubGameResultDto = {
        profileId: session.playerB,
        gameType: GAME_TYPE_TO_KAFKA['card_flip'] as KafkaGameType,
        point: winnerId === session.playerB ? winPoints : 0,
        playTime: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: winnerId === session.playerB,
        durationSeconds: durationSeconds,
        consecutivePairs: session.maxConsecutivePairsB,
      };
      await KafkaProducerService.sendGameResult(playerBResult);
      GameMatchLogModel.create({
        userId: session.playerB,
        gameType: 'card_flip',
        playTimeSec: playTime,
        sessionCompleted: session.status === 'finished',
        isWin: winnerId === session.playerB,
        points: winnerId === session.playerB ? winPoints : 0,
        playedAt: new Date(),
      }).catch((err: Error) => console.error('[Analytics] Failed to log card_flip match:', err.message));
    }
  }

  /**
   * Emit kết quả khi user disconnect giữa chừng (forfeit).
   * @param userId - User bị forfeit (thua)
   * @param gameType - Loại game internal
   * @param playTime - Thời gian đã chơi (giây)
   */
  static async emitForfeitResult(
    userId: string,
    gameType: string,
    playTime: number,
  ): Promise<void> {
    const kafkaGameType = GAME_TYPE_TO_KAFKA[gameType] as KafkaGameType;
    if (!kafkaGameType) {
      console.warn(`[GameResultEvent] Unknown game type: ${gameType}`);
      return;
    }

    const result: ClubGameResultDto = {
      profileId: userId,
      gameType: kafkaGameType,
      point: 0,
      playTime: playTime,
      sessionCompleted: false, // forfeit = không hoàn thành
      isWin: false,
    };
    await KafkaProducerService.sendGameResult(result);
  }

  /**
   * Emit kết quả Boss Battle (Săn Boss) mỗi khi 1 DailyAttempt được hoàn thành.
   */
  static async emitBossBattleResult(
    attempt: { studentId: string; correctCount: number; totalResponseTime: number; pointsEarned: number },
    _progress: unknown,
    instance: { config: { questionsPerDay: number } },
  ): Promise<void> {
    const result: ClubGameResultDto = {
      profileId: attempt.studentId,
      gameType: GAME_TYPE_TO_KAFKA['boss_battle'] as KafkaGameType,
      point: attempt.pointsEarned,
      playTime: Math.round(attempt.totalResponseTime),
      sessionCompleted: true,
      isWin: attempt.correctCount > 0,
      correctCount: attempt.correctCount,
      totalQuestions: instance.config.questionsPerDay,
    };
    await KafkaProducerService.sendGameResult(result);
    GameMatchLogModel.create({
      userId: attempt.studentId,
      gameType: 'boss_battle',
      playTimeSec: Math.round(attempt.totalResponseTime),
      sessionCompleted: true,
      isWin: attempt.correctCount > 0,
      points: attempt.pointsEarned,
      correctCount: attempt.correctCount,
      totalQuestions: instance.config.questionsPerDay,
      playedAt: new Date(),
    }).catch((err: Error) => console.error('[Analytics] Failed to log boss_battle match:', err.message));
  }
}
