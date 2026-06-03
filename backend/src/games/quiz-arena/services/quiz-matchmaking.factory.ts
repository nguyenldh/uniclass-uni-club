// ============================================================
// Quiz Arena Matchmaking Factory
// Đăng ký vào game-agnostic MatchmakingService
// ============================================================

import { MatchmakingService } from '../../../services/matchmaking.service';
import { GameConfigService } from '../../../services/game-config.service';
import { QuizArenaService } from './quiz-arena.service';
import { UserAbilityService } from './user-ability.service';
import { redis } from '../../../config/index';
import { QUIZ_ARENA_REDIS_KEYS, DEFAULT_QUIZ_ARENA_CONFIG } from '@uniclub/shared';
import type { MatchmakingSessionFactory, AIDifficulty, QuizDifficulty } from '@uniclub/shared';

export interface QuizMatchmakingContext {
  displayName: string;
  grade: number;
  abilityBucket: QuizDifficulty;
}

/** Lưu context tạm thời cho user đang matchmaking (TTL 60s) */
export async function setPendingContext(
  userId: string,
  ctx: QuizMatchmakingContext,
): Promise<void> {
  await redis.set(
    `${QUIZ_ARENA_REDIS_KEYS.PENDING_CONTEXT}:${userId}`,
    JSON.stringify(ctx),
    'EX',
    60,
  );
}

/** Lấy context tạm thời đã lưu */
export async function getPendingContext(
  userId: string,
): Promise<QuizMatchmakingContext | null> {
  const raw = await redis.get(`${QUIZ_ARENA_REDIS_KEYS.PENDING_CONTEXT}:${userId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** Xóa context sau khi đã dùng */
export async function clearPendingContext(userId: string): Promise<void> {
  await redis.del(`${QUIZ_ARENA_REDIS_KEYS.PENDING_CONTEXT}:${userId}`);
}

const quizArenaFactory: MatchmakingSessionFactory = {
  async createPVPSession(playerA: string, playerB: string) {
    const config = await GameConfigService.getQuizArenaConfig().catch(() => DEFAULT_QUIZ_ARENA_CONFIG);

    const [ctxA, ctxB] = await Promise.all([
      getPendingContext(playerA),
      getPendingContext(playerB),
    ]);

    const gradeA = ctxA?.grade ?? 10;
    const gradeB = ctxB?.grade ?? gradeA;
    const nameA = ctxA?.displayName ?? playerA;
    const nameB = ctxB?.displayName ?? playerB;
    const bucket: QuizDifficulty = ctxA?.abilityBucket ?? ctxB?.abilityBucket ?? 'medium';

    const session = await QuizArenaService.createPVPSession(
      playerA, nameA, gradeA,
      playerB, nameB, gradeB,
      bucket,
      config,
    );

    // Cleanup contexts
    await Promise.all([
      clearPendingContext(playerA),
      clearPendingContext(playerB),
    ]);

    return { sessionId: session.sessionId };
  },

  async createAISession(userId: string, difficulty: AIDifficulty) {
    const config = await GameConfigService.getQuizArenaConfig().catch(() => DEFAULT_QUIZ_ARENA_CONFIG);

    const ctx = await getPendingContext(userId);
    const grade = ctx?.grade ?? 10;
    const name = ctx?.displayName ?? userId;

    // Map AIDifficulty → QuizDifficulty (hoặc dùng ability bucket đã tính)
    const bucket: QuizDifficulty =
      ctx?.abilityBucket ?? (difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'medium');

    const { session, botProfile } = await QuizArenaService.createBotSession(userId, name, grade, bucket, config);

    await clearPendingContext(userId);

    return { sessionId: session.sessionId, botProfile };
  },
};

/** Gọi hàm này khi khởi tạo backend để đăng ký Quiz Arena vào matchmaking */
export function registerQuizArenaMatchmaking(): void {
  MatchmakingService.registerFactory('quiz', quizArenaFactory);
}
