import { create } from 'zustand';
import type {
  GomokuConfig,
  CardFlipConfig,
  QuizArenaConfig,
  BossBattleConfig,
} from '@uniclub/shared';
import configService from '../services/config.service';

interface ConfigState {
  gomoku: GomokuConfig | null;
  cardFlip: CardFlipConfig | null;
  quizArena: QuizArenaConfig | null;
  bossBattle: BossBattleConfig | null;
  isLoading: boolean;
  error: string | null;

  loadConfigs: () => Promise<void>;
  updateGomoku: (config: Partial<GomokuConfig>) => Promise<void>;
  updateCardFlip: (config: Partial<CardFlipConfig>) => Promise<void>;
  updateQuizArena: (config: Partial<QuizArenaConfig>) => Promise<void>;
  updateBossBattle: (config: BossBattleConfig) => Promise<void>;
  invalidateCache: (gameType: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  gomoku: null,
  cardFlip: null,
  quizArena: null,
  bossBattle: null,
  isLoading: false,
  error: null,

  loadConfigs: async () => {
    set({ isLoading: true, error: null });
    try {
      const configs = await configService.getAllConfigs();
      set({
        gomoku: configs.mind_game.gomoku,
        cardFlip: configs.mind_game.card_flip,
        quizArena: configs.quiz_arena,
        bossBattle: configs.boss_battle,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Không thể tải cấu hình',
      });
      throw error;
    }
  },

  updateGomoku: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await configService.updateGomoku(config);
      const current = get().gomoku;
      set({
        gomoku: current ? { ...current, ...config } : null,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Không thể cập nhật cấu hình',
      });
      throw error;
    }
  },

  updateCardFlip: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await configService.updateCardFlip(config);
      const current = get().cardFlip;
      set({
        cardFlip: current ? { ...current, ...config } : null,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Không thể cập nhật cấu hình',
      });
      throw error;
    }
  },

  updateQuizArena: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await configService.updateQuizArena(config);
      const current = get().quizArena;
      set({
        quizArena: current ? { ...current, ...config } : null,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Không thể cập nhật cấu hình',
      });
      throw error;
    }
  },

  updateBossBattle: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await configService.updateBossBattle(config);
      set({ bossBattle: config, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Không thể cập nhật cấu hình',
      });
      throw error;
    }
  },

  invalidateCache: async (gameType) => {
    try {
      await configService.invalidateCache(gameType);
    } catch (error: any) {
      throw error;
    }
  },
}));

export default useConfigStore;
