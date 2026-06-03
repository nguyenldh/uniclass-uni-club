// ============================================================
// Game Result Event Service — Map & emit kết quả game sang Kafka
// ============================================================

import { KafkaProducerService } from './kafka-producer.service';
import type {
  ClubGameResultDto,
  KafkaGameType,
  CardFlipSession,
  GomokuSession,
  QuizArenaSession,
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
  static async emitQuizArenaResult(session: QuizArenaSession): Promise<void> {
    const playTime = calculatePlayTime(session.startedAt, session.endedAt);
    const totalQuestions = session.questions.length;

    // Emit cho playerA (luôn là người thật)
    const playerAResult: ClubGameResultDto = {
      profile_id: session.playerA,
      game_type: GAME_TYPE_TO_KAFKA['quiz_arena'] as KafkaGameType,
      point: session.playerAState.totalScore,
      play_time: playTime,
      session_completed: session.status === 'finished',
      is_win: session.winner === session.playerA,
      correct_count: session.playerAState.correctCount,
      total_questions: totalQuestions,
    };
    await KafkaProducerService.sendGameResult(playerAResult);

    // Emit cho playerB nếu không phải bot
    if (!session.isBot && session.playerB !== 'BOT') {
      const playerBResult: ClubGameResultDto = {
        profile_id: session.playerB,
        game_type: GAME_TYPE_TO_KAFKA['quiz_arena'] as KafkaGameType,
        point: session.playerBState.totalScore,
        play_time: playTime,
        session_completed: session.status === 'finished',
        is_win: session.winner === session.playerB,
        correct_count: session.playerBState.correctCount,
        total_questions: totalQuestions,
      };
      await KafkaProducerService.sendGameResult(playerBResult);
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
      profile_id: session.playerX,
      game_type: GAME_TYPE_TO_KAFKA['gomoku'] as KafkaGameType,
      point: winnerId === session.playerX ? winPoints : 0,
      play_time: playTime,
      session_completed: session.status === 'finished',
      is_win: winnerId === session.playerX,
    };
    await KafkaProducerService.sendGameResult(playerXResult);

    // Emit cho playerO nếu không phải AI
    if (!session.isAI && session.playerO !== 'AI') {
      const playerOResult: ClubGameResultDto = {
        profile_id: session.playerO,
        game_type: GAME_TYPE_TO_KAFKA['gomoku'] as KafkaGameType,
        point: winnerId === session.playerO ? winPoints : 0,
        play_time: playTime,
        session_completed: session.status === 'finished',
        is_win: winnerId === session.playerO,
      };
      await KafkaProducerService.sendGameResult(playerOResult);
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
      profile_id: session.playerA,
      game_type: GAME_TYPE_TO_KAFKA['card_flip'] as KafkaGameType,
      point: winnerId === session.playerA ? winPoints : 0,
      play_time: playTime,
      session_completed: session.status === 'finished',
      is_win: winnerId === session.playerA,
      duration_seconds: durationSeconds,
      consecutive_pairs: session.maxConsecutivePairsA,
    };
    await KafkaProducerService.sendGameResult(playerAResult);

    // Emit cho playerB nếu không phải AI
    if (!session.isAI && session.playerB !== 'AI') {
      const playerBResult: ClubGameResultDto = {
        profile_id: session.playerB,
        game_type: GAME_TYPE_TO_KAFKA['card_flip'] as KafkaGameType,
        point: winnerId === session.playerB ? winPoints : 0,
        play_time: playTime,
        session_completed: session.status === 'finished',
        is_win: winnerId === session.playerB,
        duration_seconds: durationSeconds,
        consecutive_pairs: session.maxConsecutivePairsB,
      };
      await KafkaProducerService.sendGameResult(playerBResult);
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
      profile_id: userId,
      game_type: kafkaGameType,
      point: 0,
      play_time: playTime,
      session_completed: false, // forfeit = không hoàn thành
      is_win: false,
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
      profile_id: attempt.studentId,
      game_type: GAME_TYPE_TO_KAFKA['boss_battle'] as KafkaGameType,
      point: attempt.pointsEarned,
      play_time: Math.round(attempt.totalResponseTime),
      session_completed: true,
      is_win: attempt.correctCount > 0,
      correct_count: attempt.correctCount,
      total_questions: instance.config.questionsPerDay,
    };
    await KafkaProducerService.sendGameResult(result);
  }
}
