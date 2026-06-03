// ============================================================
// Quiz Arena Services — barrel export
// ============================================================

export { QuizArenaService } from './quiz-arena.service';
export { QuestionService } from './question.service';
export { UserAbilityService } from './user-ability.service';
export { QuizBotService } from './quiz-bot.service';
export { UniClassSyncService } from './uniclass-sync.service';
export {
  registerQuizArenaMatchmaking,
  setPendingContext,
  getPendingContext,
  clearPendingContext,
} from './quiz-matchmaking.factory';
export type { QuizMatchmakingContext } from './quiz-matchmaking.factory';
