import type { AIDifficulty, GomokuSession, CardFlipSession } from '@uniclub/shared';
import { apiRequest } from './auth';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/mind-game`;

export interface ActiveSessionResponse {
  success: boolean;
  hasActiveSession: boolean;
  sessionId?: string;
  gameType?: string;
  isBot?: boolean;
}

export const mindGameApi = {
  // ---- Gomoku ----
  // Gameplay (start vs AI / move) đi qua Socket.IO — xem useGomokuSocket.
  getGomokuSession: (sessionId: string) =>
    apiRequest<{ success: boolean; session: GomokuSession }>(API_BASE, `/gomoku/${sessionId}`),

  // ---- Card Flip ----
  getCardFlipSession: (sessionId: string) =>
    apiRequest<{ success: boolean; session: CardFlipSession }>(API_BASE, `/card-flip/${sessionId}`),

  /**
   * Kiểm tra user có session mind-game đang diễn ra không.
   * Nếu có → frontend tự động reconnect vào session đó.
   */
  checkActiveSession: (userId: string) =>
    apiRequest<ActiveSessionResponse>(API_BASE, `/active-session/${userId}`),

  // ---- Matchmaking ----
  joinMatchmaking: (userId: string, socketId: string) =>
    apiRequest<{ success: boolean }>(API_BASE, '/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify({ userId, socketId }),
    }),

  leaveMatchmaking: (userId: string) =>
    apiRequest<{ success: boolean }>(API_BASE, '/matchmaking/leave', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};
