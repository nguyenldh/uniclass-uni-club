import type { QuizArenaSession, QuizArenaConfig } from '@uniclub/shared';
import { apiRequest } from './auth';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/quiz-arena`;
const CONFIG_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/config`;

export interface ActiveSessionResponse {
  success: boolean;
  hasActiveSession: boolean;
  sessionId?: string;
  gameType?: string;
  isBot?: boolean;
  /** Trận mời (friendly) — reconnect cần biết để hiện nút Tái đấu. */
  friendly?: boolean;
  /** ID phòng mời (chỉ có khi friendly). */
  roomId?: string;
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

  /**
   * Kiểm tra khối lớp đã có câu hỏi chưa — gọi TRƯỚC khi ghép trận.
   * Nếu chưa có → hiển thị màn "không có câu hỏi" thay vì vào ghép trận.
   */
  hasQuestions: (grade: number) =>
    apiRequest<{ success: boolean; hasQuestions: boolean }>(API_BASE, `/has-questions/${grade}`),

  /** Lấy config public của So Tài (dùng để hiển thị hệ số nhân điểm mời bạn, v.v.) */
  getConfig: () =>
    apiRequest<{ success: boolean; config: QuizArenaConfig }>(CONFIG_BASE, `/quiz-arena`),
};
