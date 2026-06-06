// ============================================================
// Mind Game — Matchmaking Service
// ============================================================

import { redis } from '../../../config/index';
import { GameConfigService } from '../../../services/game-config.service';
import { GomokuService } from './gomoku.service';
import { MIND_GAME_REDIS_KEYS } from '@uniclub/shared';
import type { MatchmakingEntry, MatchmakingResult, MindGameType } from '@uniclub/shared';

export class MatchmakingService {
  private static readonly QUEUE_KEY = MIND_GAME_REDIS_KEYS.MATCHMAKING_QUEUE;

  /** Tham gia queue matchmaking */
  static async joinQueue(entry: MatchmakingEntry): Promise<MatchmakingResult> {
    const config = await GameConfigService.getGomokuConfig();

    const queueData = await redis.lrange(`${this.QUEUE_KEY}:gomoku`, 0, -1);

    console.log(entry);    

    for (const data of queueData) {
      const waiting: MatchmakingEntry = JSON.parse(data);

      if (waiting.userId === entry.userId) continue;

      await redis.lrem(`${this.QUEUE_KEY}:gomoku`, 0, data);

      const session = await GomokuService.createPVPSession(waiting.userId, entry.userId);

      return {
        status: 'matched',
        gameType: 'gomoku',
        opponentId: waiting.userId,
        sessionId: session.sessionId,
        isAI: false,
      };
    }

    await redis.rpush(`${this.QUEUE_KEY}:gomoku`, JSON.stringify(entry));
    await redis.expire(`${this.QUEUE_KEY}:gomoku`, config.matchmakingTimeout + 10);

    return { status: 'searching', gameType: 'gomoku' };
  }

  /** Rời queue */
  static async leaveQueue(userId: string, gameType: MindGameType): Promise<void> {
    const queueData = await redis.lrange(`${this.QUEUE_KEY}:${gameType}`, 0, -1);

    for (const data of queueData) {
      const entry: MatchmakingEntry = JSON.parse(data);
      if (entry.userId === userId) {
        await redis.lrem(`${this.QUEUE_KEY}:${gameType}`, 0, data);
        break;
      }
    }
  }

  /** Xử lý timeout — chuyển sang đấu AI */
  static async handleTimeout(userId: string): Promise<MatchmakingResult> {
    await this.leaveQueue(userId, 'gomoku');

    const { session, botProfile } = await GomokuService.createAISession(userId, 'medium');

    return {
      status: 'timeout',
      gameType: 'gomoku',
      sessionId: session.sessionId,
      isAI: true,
      aiDifficulty: 'medium',
      opponentProfile: botProfile,
    };
  }

  /** Lấy kích thước queue */
  static async getQueueSize(gameType: MindGameType): Promise<number> {
    return redis.llen(`${this.QUEUE_KEY}:${gameType}`);
  }
}
