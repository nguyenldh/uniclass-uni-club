import api from './api';
import type {
  GomokuConfig,
  CardFlipConfig,
  QuizArenaConfig,
  BossBattleConfig,
} from '@uniclub/shared';

export interface AllConfigsResponse {
  success: boolean;
  configs: {
    mind_game: {
      gomoku: GomokuConfig;
      card_flip: CardFlipConfig;
    };
    quiz_arena: QuizArenaConfig;
    boss_battle: BossBattleConfig;
  };
}

export const configService = {
  /**
   * Lấy tất cả config
   */
  async getAllConfigs(): Promise<AllConfigsResponse['configs']> {
    const response = await api.get<AllConfigsResponse>('/config');
    return response.data.configs;
  },

  /**
   * Cập nhật config Gomoku
   */
  async updateGomoku(config: Partial<GomokuConfig>): Promise<void> {
    await api.put('/config/gomoku', config);
  },

  /**
   * Cập nhật config Card Flip
   */
  async updateCardFlip(config: Partial<CardFlipConfig>): Promise<void> {
    await api.put('/config/card-flip', config);
  },

  /**
   * Cập nhật config Quiz Arena
   */
  async updateQuizArena(config: Partial<QuizArenaConfig>): Promise<void> {
    await api.put('/config/quiz-arena', config);
  },

  /**
   * Cập nhật config Boss Battle (Săn Boss)
   */
  async updateBossBattle(config: Partial<BossBattleConfig>): Promise<void> {
    await api.put('/boss-battle/config', config);
  },

  /**
   * Invalidate cache cho game type
   */
  async invalidateCache(gameType: string): Promise<void> {
    await api.post('/config/invalidate-cache', { gameType });
  },

  /**
   * Recompute độ khó câu hỏi Quiz Arena
   */
  async recomputeQuizDifficulty(): Promise<{ count: number }> {
    const response = await api.post<{ success: boolean; message: string }>('/quiz-arena/recompute-difficulty');
    // Parse count from message "Recomputed difficulty for X questions"
    const match = response.data.message.match(/(\d+)/);
    return { count: match ? parseInt(match[1], 10) : 0 };
  },
};

export default configService;
