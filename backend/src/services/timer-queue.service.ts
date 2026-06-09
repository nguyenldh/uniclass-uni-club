import { Queue, Worker, Job } from 'bullmq';
import { createBullRedisConnection } from '../config/index';
import { getIO } from '../sockets/index';

const QUEUE_NAME = '{game-timers}';

let queue: Queue;
let worker: Worker;

export class TimerQueueService {
  /**
   * Khởi tạo BullMQ Queue và Worker.
   */
  static init(): void {
    const connection = createBullRedisConnection();

    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });

    worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const io = getIO();
        const { name, data } = job;

        switch (name) {
          case 'matchmaking-timeout': {
            const { MatchmakingService } = await import('./matchmaking.service');
            const { userId, gameType, partitionKey, socketId } = data;
            const timeoutResult = await MatchmakingService.handleTimeout(
              userId,
              gameType,
              'medium',
              partitionKey,
            );
            if (timeoutResult && timeoutResult.status === 'timeout') {
              await MatchmakingService.setActiveSession(userId, timeoutResult.sessionId!, gameType);
              
              // Join socket vào session room xuyên suốt các instance
              io.in(socketId).socketsJoin(timeoutResult.sessionId!);

              // Emit event tới socket (cross-instance)
              io.to(socketId).emit('matchmaking:timeout', {
                sessionId: timeoutResult.sessionId,
                gameType,
                isAI: true,
                aiDifficulty: timeoutResult.aiDifficulty,
                opponentProfile: timeoutResult.opponentProfile,
              });
            }
            break;
          }
          case 'quiz-question-timeout': {
            const { QuizArenaService } = await import('../games/quiz-arena/services/quiz-arena.service');
            const { sessionId, questionIndex } = data;
            await QuizArenaService.handleQuestionTimeout(sessionId, questionIndex, io);
            break;
          }
          case 'quiz-next-question': {
            const { QuizArenaService } = await import('../games/quiz-arena/services/quiz-arena.service');
            const { sessionId, isLastQuestion } = data;
            if (isLastQuestion) {
              await QuizArenaService.endMatch(sessionId, io);
            } else {
              await QuizArenaService.startNextQuestion(sessionId, io);
            }
            break;
          }
          case 'quiz-bot-turn': {
            const { QuizArenaService } = await import('../games/quiz-arena/services/quiz-arena.service');
            const { sessionId, botPlayerId, selectedIndex } = data;
            await QuizArenaService.submitAnswer(sessionId, botPlayerId, selectedIndex, io);
            break;
          }
          case 'quiz-disconnect-grace': {
            const { QuizArenaService } = await import('../games/quiz-arena/services/quiz-arena.service');
            const { sessionId, userId } = data;
            
            const currentSession = await QuizArenaService.getSession(sessionId);
            if (!currentSession || currentSession.status !== 'playing') return;

            const userState =
              currentSession.playerA === userId
                ? currentSession.playerAState
                : currentSession.playerBState;
            if (!userState.disconnected) return;

            await QuizArenaService.endMatch(sessionId, io);
            break;
          }
        }
      },
      { connection }
    );

    worker.on('failed', (job, err) => {
      console.error(`[TimerQueue] Job ${job?.id} failed:`, err);
    });

    console.log('[TimerQueue] Initialized BullMQ queue and worker');
  }

  // ============================================================
  // Matchmaking Timeout Helpers
  // ============================================================

  static async scheduleMatchmakingTimeout(
    data: { userId: string; gameType: string; partitionKey?: string; socketId: string },
    delayMs: number
  ): Promise<void> {
    const jobId = `matchmaking-timeout:${data.userId}:${data.gameType}`;
    await queue.remove(jobId);
    await queue.add('matchmaking-timeout', data, {
      jobId,
      delay: delayMs,
    });
  }

  static async cancelMatchmakingTimeout(userId: string, gameType: string): Promise<void> {
    await queue.remove(`matchmaking-timeout:${userId}:${gameType}`);
  }

  // ============================================================
  // Quiz Arena Timeout Helpers
  // ============================================================

  static async scheduleQuestionTimeout(
    sessionId: string,
    questionIndex: number,
    delayMs: number
  ): Promise<void> {
    const jobId = `quiz-question-timeout:${sessionId}`;
    await queue.remove(jobId);
    await queue.add('quiz-question-timeout', { sessionId, questionIndex }, {
      jobId,
      delay: delayMs,
    });
  }

  static async cancelQuestionTimeout(sessionId: string): Promise<void> {
    await queue.remove(`quiz-question-timeout:${sessionId}`);
  }

  static async scheduleBotTurn(
    sessionId: string,
    botPlayerId: string,
    selectedIndex: number | null,
    delayMs: number
  ): Promise<void> {
    const jobId = `quiz-bot-turn:${sessionId}`;
    await queue.remove(jobId);
    await queue.add('quiz-bot-turn', { sessionId, botPlayerId, selectedIndex }, {
      jobId,
      delay: delayMs,
    });
  }

  static async cancelBotTurn(sessionId: string): Promise<void> {
    await queue.remove(`quiz-bot-turn:${sessionId}`);
  }

  static async scheduleNextQuestion(
    sessionId: string,
    isLastQuestion: boolean,
    delayMs: number
  ): Promise<void> {
    const jobId = `quiz-next-question:${sessionId}`;
    await queue.remove(jobId);
    await queue.add('quiz-next-question', { sessionId, isLastQuestion }, {
      jobId,
      delay: delayMs,
    });
  }

  static async cancelNextQuestion(sessionId: string): Promise<void> {
    await queue.remove(`quiz-next-question:${sessionId}`);
  }

  static async scheduleDisconnectGrace(
    sessionId: string,
    userId: string,
    delayMs: number
  ): Promise<void> {
    const jobId = `quiz-disconnect-grace:${sessionId}:${userId}`;
    await queue.remove(jobId);
    await queue.add('quiz-disconnect-grace', { sessionId, userId }, {
      jobId,
      delay: delayMs,
    });
  }

  static async cancelDisconnectGrace(sessionId: string, userId: string): Promise<void> {
    await queue.remove(`quiz-disconnect-grace:${sessionId}:${userId}`);
  }
}
