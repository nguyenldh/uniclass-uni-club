import type { QuizArenaSession } from '@uniclub/shared';
import { apiRequest } from './auth';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/quiz-arena`;

export interface ActiveSessionResponse {
  success: boolean;
  hasActiveSession: boolean;
  sessionId?: string;
  gameType?: string;
  isBot?: boolean;
}

export const quizArenaApi = {
  getSession: (sessionId: string) =>
    apiRequest<{ success: boolean; session: QuizArenaSession }>(API_BASE, `/${sessionId}`),

  /**
   * Kiểm tra user có session đang diễn ra không.
   * Nếu có → frontend tự động reconnect vào session đó.
   */
  checkActiveSession: (userId: string) =>
    apiRequest<ActiveSessionResponse>(API_BASE, `/active-session/${userId}`),
};
