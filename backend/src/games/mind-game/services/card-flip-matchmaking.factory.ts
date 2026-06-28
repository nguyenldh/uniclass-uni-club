// ============================================================
// Card Flip Matchmaking Factory — đăng ký vào MatchmakingService
// ============================================================

import { redis } from '../../../config/index';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { CardFlipService } from './card-flip.service';
import { MIND_GAME_REDIS_KEYS } from '@uniclub/shared';
import type { MatchmakingSessionFactory, AIDifficulty, CardFlipMode } from '@uniclub/shared';

/** Key lưu chế độ chơi user đã chọn khi đang tìm trận (TTL ngắn) */
function pendingModeKey(userId: string): string {
  return `${MIND_GAME_REDIS_KEYS.CARD_FLIP_SESSION}:pending-mode:${userId}`;
}

/** Lưu chế độ chơi user chọn trước khi ghép trận (TTL 120s) */
export async function setPendingCardFlipMode(userId: string, mode: CardFlipMode): Promise<void> {
  await redis.set(pendingModeKey(userId), mode, 'EX', 120);
}

/** Lấy chế độ chơi đã lưu (mặc định 'basic' nếu thiếu) */
async function getPendingCardFlipMode(userId: string): Promise<CardFlipMode> {
  const raw = await redis.get(pendingModeKey(userId));
  return raw === 'advanced' ? 'advanced' : 'basic';
}

/** Xóa chế độ chơi tạm sau khi đã tạo session */
async function clearPendingCardFlipMode(userId: string): Promise<void> {
  await redis.del(pendingModeKey(userId));
}

const cardFlipFactory: MatchmakingSessionFactory = {
  async createPVPSession(playerA: string, playerB: string) {
    // 2 người cùng partition = cùng mode; đọc của playerA, fallback playerB
    const [modeA, modeB] = await Promise.all([
      getPendingCardFlipMode(playerA),
      getPendingCardFlipMode(playerB),
    ]);
    const mode: CardFlipMode = modeA === 'advanced' || modeB === 'advanced' ? 'advanced' : 'basic';
    const session = await CardFlipService.createPVPSession(playerA, playerB, mode);
    await Promise.all([clearPendingCardFlipMode(playerA), clearPendingCardFlipMode(playerB)]);
    return { sessionId: session.sessionId };
  },

  async createAISession(userId: string, difficulty: AIDifficulty) {
    const mode = await getPendingCardFlipMode(userId);
    const { session, botProfile } = await CardFlipService.createAISession(userId, difficulty, mode);
    await clearPendingCardFlipMode(userId);
    return { sessionId: session.sessionId, botProfile };
  },
};

/** Gọi hàm này khi khởi tạo backend để đăng ký Card Flip vào matchmaking */
export function registerCardFlipMatchmaking(): void {
  MatchmakingService.registerFactory('card_flip', cardFlipFactory);
}