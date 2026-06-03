// ============================================================
// Card Flip Matchmaking Factory — đăng ký vào MatchmakingService
// ============================================================

import { MatchmakingService } from '../../../services/matchmaking.service';
import { CardFlipService } from './card-flip.service';
import type { MatchmakingSessionFactory, AIDifficulty } from '@uniclub/shared';

const cardFlipFactory: MatchmakingSessionFactory = {
  async createPVPSession(playerA: string, playerB: string) {
    const session = await CardFlipService.createPVPSession(playerA, playerB);
    return { sessionId: session.sessionId };
  },

  async createAISession(userId: string, difficulty: AIDifficulty) {
    const { session, botProfile } = await CardFlipService.createAISession(userId, difficulty);
    return { sessionId: session.sessionId, botProfile };
  },
};

/** Gọi hàm này khi khởi tạo backend để đăng ký Card Flip vào matchmaking */
export function registerCardFlipMatchmaking(): void {
  MatchmakingService.registerFactory('card_flip', cardFlipFactory);
}