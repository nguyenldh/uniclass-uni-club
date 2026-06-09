// ============================================================
// Unit Tests — Score Service
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockRedis, mockUserScoreModel } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    exists: vi.fn(),
    zrevrange: vi.fn(),
    multi: vi.fn(),
    zadd: vi.fn(),
  },
  mockUserScoreModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../config/index', () => ({
  redis: mockRedis,
}));

vi.mock('../models/index', () => ({
  UserScoreModel: mockUserScoreModel,
}));

import { ScoreService } from './score.service';

const EMPTY_DETAIL = { points: 0, played: 0, won: 0 };

function makeDoc(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1',
    totalPoints: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    mind_game: EMPTY_DETAIL,
    quiz_arena: EMPTY_DETAIL,
    boss_battle: EMPTY_DETAIL,
    weekly_event: EMPTY_DETAIL,
    gomoku: EMPTY_DETAIL,
    card_flip: EMPTY_DETAIL,
    ...overrides,
  };
}

describe('ScoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserScore', () => {
    it('trả về từ Redis cache nếu có', async () => {
      const cached = makeDoc({ userId: 'user-1', totalPoints: 500, gamesPlayed: 10, gamesWon: 5 });
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const score = await ScoreService.getUserScore('user-1');

      expect(score.totalPoints).toBe(500);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      expect(mockUserScoreModel.findOne).not.toHaveBeenCalled();
    });

    it('lấy từ DB và cache nếu Redis miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserScoreModel.findOne.mockResolvedValue(makeDoc({ totalPoints: 300, gamesPlayed: 6, gamesWon: 3 }));
      mockRedis.set.mockResolvedValue('OK');

      const score = await ScoreService.getUserScore('user-1');

      expect(score.totalPoints).toBe(300);
      expect(score.gamesPlayed).toBe(6);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    it('tạo mới nếu user chưa có trong DB', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockUserScoreModel.findOne.mockResolvedValue(null);
      mockUserScoreModel.create.mockResolvedValue(makeDoc());
      mockRedis.set.mockResolvedValue('OK');

      const score = await ScoreService.getUserScore('user-new');

      expect(score.totalPoints).toBe(0);
      expect(score.gamesPlayed).toBe(0);
      expect(mockUserScoreModel.create).toHaveBeenCalledWith({
        userId: 'user-new',
        totalPoints: 0,
        gamesPlayed: 0,
        gamesWon: 0,
      });
    });
  });

  describe('addWinPoints', () => {
    it('cộng điểm vào total, gameType và subGameType', async () => {
      mockUserScoreModel.findOneAndUpdate.mockResolvedValue(
        makeDoc({ totalPoints: 150, gamesPlayed: 4, gamesWon: 2, gomoku: { points: 150, played: 4, won: 2 } }),
      );
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.multi.mockReturnValue({
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      const score = await ScoreService.addWinPoints('user-1', 50, 'mind_game', 'gomoku');

      expect(score.totalPoints).toBe(150);
      expect(score.gomoku.points).toBe(150);
      expect(mockUserScoreModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1' },
        {
          $inc: {
            totalPoints: 50,
            gamesPlayed: 1,
            gamesWon: 1,
            'mind_game.points': 50,
            'mind_game.played': 1,
            'mind_game.won': 1,
            'gomoku.points': 50,
            'gomoku.played': 1,
            'gomoku.won': 1,
          },
          $set: { lastPlayedAt: expect.any(Date) },
        },
        { upsert: true, new: true },
      );
    });
  });

  describe('recordLoss', () => {
    it('chỉ tăng played, không tăng điểm', async () => {
      mockUserScoreModel.findOneAndUpdate.mockResolvedValue(
        makeDoc({ totalPoints: 100, gamesPlayed: 5, gamesWon: 1 }),
      );
      mockRedis.set.mockResolvedValue('OK');

      const score = await ScoreService.recordLoss('user-1', 'mind_game', 'gomoku');

      expect(score.totalPoints).toBe(100);
      expect(score.gamesPlayed).toBe(5);
      expect(score.gamesWon).toBe(1);
      expect(mockUserScoreModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1' },
        {
          $inc: {
            gamesPlayed: 1,
            'mind_game.played': 1,
            'gomoku.played': 1,
          },
          $set: { lastPlayedAt: expect.any(Date) },
        },
        { upsert: true, new: true },
      );
    });
  });

  describe('getLeaderboard', () => {
    it('trả về top N từ Redis sorted set', async () => {
      mockRedis.exists.mockResolvedValue(1); // cache hit
      mockRedis.zrevrange.mockResolvedValue(['user-3', '1000', 'user-1', '500', 'user-2', '300']);

      // getUserScore sẽ được gọi cho từng user
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(makeDoc({ userId: 'user-3', totalPoints: 1000 })))
        .mockResolvedValueOnce(JSON.stringify(makeDoc({ userId: 'user-1', totalPoints: 500 })))
        .mockResolvedValueOnce(JSON.stringify(makeDoc({ userId: 'user-2', totalPoints: 300 })));

      const leaderboard = await ScoreService.getLeaderboard('total', 3);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].userId).toBe('user-3');
      expect(leaderboard[0].totalPoints).toBe(1000);
      expect(leaderboard[2].userId).toBe('user-2');
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('leaderboard:total', 0, 2, 'WITHSCORES');
    });

    it('sync từ MongoDB nếu Redis miss', async () => {
      mockRedis.exists.mockResolvedValue(0); // cache miss
      mockRedis.zrevrange.mockResolvedValue(['user-1', '500']);

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([makeDoc({ userId: 'user-1', totalPoints: 500 })]),
      };
      mockUserScoreModel.find.mockReturnValue(mockQuery);

      mockRedis.multi.mockReturnValue({
        del: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(makeDoc({ userId: 'user-1', totalPoints: 500 })));

      const leaderboard = await ScoreService.getLeaderboard('gomoku', 10);

      expect(leaderboard).toHaveLength(1);
      expect(mockUserScoreModel.find).toHaveBeenCalled();
    });
  });
});
