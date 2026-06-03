// ============================================================
// Gomoku Matchmaking Factory — đăng ký vào MatchmakingService
// ============================================================

import { MatchmakingService } from '../../../services/matchmaking.service';
import { GomokuService } from './gomoku.service';
import type { MatchmakingSessionFactory, AIDifficulty } from '@uniclub/shared';

const gomokuFactory: MatchmakingSessionFactory = {
  async createPVPSession(playerA: string, playerB: string) {
    const session = await GomokuService.createPVPSession(playerA, playerB);
    return { sessionId: session.sessionId };
  },

  async createAISession(userId: string, difficulty: AIDifficulty) {
    const { session, botProfile } = await GomokuService.createAISession(userId, difficulty);
    return { sessionId: session.sessionId, botProfile };
  },
};

/** Gọi hàm này khi khởi tạo backend để đăng ký Gomoku vào matchmaking */
export function registerGomokuMatchmaking(): void {
  MatchmakingService.registerFactory('gomoku', gomokuFactory);
}
