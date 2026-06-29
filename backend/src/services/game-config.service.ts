import { redis } from '../config/index';
import { GameConfigModel } from '../models/index';
import type {
  GomokuConfig,
  CardFlipConfig,
  MindGameType,
  MatchmakingGameType,
  QuizArenaConfig,
  BossBattleConfig,
  OpponentMode,
} from '@uniclub/shared';
import {
  DEFAULT_GOMOKU_CONFIG,
  DEFAULT_CARD_FLIP_CONFIG,
  DEFAULT_MATCHMAKING_CONFIG,
  DEFAULT_QUIZ_ARENA_CONFIG,
  DEFAULT_BOSS_BATTLE_CONFIG,
  REDIS_KEYS,
} from '@uniclub/shared';

export class GameConfigService {
  static async getGomokuConfig(): Promise<GomokuConfig> {
    const cached = await redis.get(`${REDIS_KEYS.GAME_CONFIG}:mind-game:gomoku`);
    if (cached) return JSON.parse(cached);

    const doc = await GameConfigModel.findOne({ gameType: 'gomoku' });
    const config = doc?.gomoku
      ? { ...DEFAULT_GOMOKU_CONFIG, ...(doc.gomoku as any).toObject() }
      : DEFAULT_GOMOKU_CONFIG;

    await redis.set(
      `${REDIS_KEYS.GAME_CONFIG}:mind-game:gomoku`,
      JSON.stringify(config),
      'EX',
      300,
    );

    return config;
  }

  static async getCardFlipConfig(): Promise<CardFlipConfig> {
    const cached = await redis.get(`${REDIS_KEYS.GAME_CONFIG}:mind-game:card_flip`);
    if (cached) return JSON.parse(cached);

    const doc = await GameConfigModel.findOne({ gameType: 'card_flip' });
    const config = doc?.cardFlip
      ? { ...DEFAULT_CARD_FLIP_CONFIG, ...(doc.cardFlip as any).toObject() }
      : DEFAULT_CARD_FLIP_CONFIG;

    await redis.set(
      `${REDIS_KEYS.GAME_CONFIG}:mind-game:card_flip`,
      JSON.stringify(config),
      'EX',
      300,
    );

    return config;
  }

  static async getQuizArenaConfig(): Promise<QuizArenaConfig> {
    const cached = await redis.get(`${REDIS_KEYS.GAME_CONFIG}:quiz_arena`);
    if (cached) return JSON.parse(cached);

    const doc = await GameConfigModel.findOne({ gameType: 'quiz_arena' });
    // Merge với default để các field mới (vd: opponentMode) luôn có giá trị
    // kể cả khi doc cũ trong DB chưa có field đó.
    const config = doc?.quizArena
      ? { ...DEFAULT_QUIZ_ARENA_CONFIG, ...(doc.quizArena as any).toObject() }
      : DEFAULT_QUIZ_ARENA_CONFIG;

    await redis.set(
      `${REDIS_KEYS.GAME_CONFIG}:quiz_arena`,
      JSON.stringify(config),
      'EX',
      300,
    );

    return config;
  }

  static async getBossBattleConfig(): Promise<BossBattleConfig> {
    const cached = await redis.get(`${REDIS_KEYS.GAME_CONFIG}:boss_battle`);
    if (cached) return JSON.parse(cached);

    const doc = await GameConfigModel.findOne({ gameType: 'boss_battle' });
    const config = doc?.bossBattle
      ? { ...DEFAULT_BOSS_BATTLE_CONFIG, ...(doc.bossBattle as any).toObject() }
      : DEFAULT_BOSS_BATTLE_CONFIG;

    await redis.set(
      `${REDIS_KEYS.GAME_CONFIG}:boss_battle`,
      JSON.stringify(config),
      'EX',
      300,
    );

    return config;
  }

  /**
   * Lấy thông số ghép trận của một game type (game-agnostic):
   * - `matchmakingTimeout`: tổng thời gian tìm trận (giây), dùng hiển thị cho client.
   * - `botActivationSeconds`: mốc bắt đầu cho phép ghép bot (chỉ dùng khi mode = 'mixed').
   * - `opponentMode`: 'mixed' (tìm người thật rồi mới bot) hoặc 'bot_only' (chỉ bot).
   * Fallback an toàn nếu thiếu config hoặc lỗi đọc DB.
   */
  static async getMatchmakingTiming(gameType: MatchmakingGameType): Promise<{
    matchmakingTimeout: number;
    botActivationSeconds: number;
    opponentMode: OpponentMode;
  }> {
    try {
      let config: { matchmakingTimeout: number; botActivationSeconds?: number; opponentMode?: OpponentMode } | null = null;
      if (gameType === 'gomoku') {
        config = await this.getGomokuConfig();
      } else if (gameType === 'card_flip') {
        config = await this.getCardFlipConfig();
      } else if (gameType === 'quiz' || gameType === 'quiz_arena') {
        config = await this.getQuizArenaConfig();
      }

      if (config) {
        const matchmakingTimeout = config.matchmakingTimeout;
        return {
          matchmakingTimeout,
          // Fallback: nếu thiếu botActivationSeconds, dùng 50% timeout
          botActivationSeconds: config.botActivationSeconds ?? Math.round(matchmakingTimeout / 2),
          opponentMode: config.opponentMode ?? 'mixed',
        };
      }
    } catch {
      // fallback bên dưới
    }
    const timeout = DEFAULT_MATCHMAKING_CONFIG.timeout;
    return {
      matchmakingTimeout: timeout,
      botActivationSeconds: Math.round(timeout / 2),
      opponentMode: 'mixed',
    };
  }

  /** Lấy matchmaking timeout cho một game type (game-agnostic) */
  static async getMatchmakingTimeout(gameType: MatchmakingGameType): Promise<number> {
    try {
      if (gameType === 'gomoku') {
        const config = await this.getGomokuConfig();
        return config.matchmakingTimeout;
      }
      if (gameType === 'card_flip') {
        const config = await this.getCardFlipConfig();
        return config.matchmakingTimeout;
      }
      if (gameType === 'quiz' || gameType === 'quiz_arena') {
        const config = await this.getQuizArenaConfig();
        return config.matchmakingTimeout;
      }
      // Các game khác có thể thêm case ở đây khi có config riêng
    } catch {
      // fallback
    }
    return DEFAULT_MATCHMAKING_CONFIG.timeout;
  }

  /** Cập nhật config từ CMS */
  static async updateConfig(
    gameType: MindGameType | 'quiz_arena' | 'boss_battle',
    config: GomokuConfig | CardFlipConfig | QuizArenaConfig | BossBattleConfig,
  ): Promise<void> {
    let updateField: string;
    if (gameType === 'gomoku') updateField = 'gomoku';
    else if (gameType === 'card_flip') updateField = 'cardFlip';
    else if (gameType === 'quiz_arena') updateField = 'quizArena';
    else updateField = 'bossBattle';

    await GameConfigModel.findOneAndUpdate(
      { gameType },
      { $set: { [updateField]: config } },
      { upsert: true, new: true },
    );

    await this.invalidateCache(gameType);
  }

  /** Invalidate cache */
  static async invalidateCache(gameType: MindGameType | 'quiz_arena' | 'boss_battle'): Promise<void> {
    // Redis key pattern phải khớp với get methods
    if (gameType === 'gomoku' || gameType === 'card_flip') {
      await redis.del(`${REDIS_KEYS.GAME_CONFIG}:mind-game:${gameType}`);
    } else {
      await redis.del(`${REDIS_KEYS.GAME_CONFIG}:${gameType}`);
    }
  }
}
