import { Router, Request, Response } from 'express';
import { GameConfigService } from '../../services/game-config.service';
import { ScoreService } from '../../services/score.service';
import { BotProfileService } from '../../services/bot-profile.service';
import { QuestionService } from '../../games/quiz-arena/services/question.service';
import { requireAdminAuth } from '../../middleware';
import adminAuthRouter from './auth';
import bossBattleAdminRouter from '../../games/boss-battle/routes/admin';
import weeklyEventAdminRouter from '../../games/weekly-event/routes/admin';
import analyticsAdminRouter from './analytics';
import type { CreateBotProfileInput, UpdateBotProfileInput } from '@uniclub/shared';

const router = Router();

// ============================================================
// Auth routes (không cần middleware)
// ============================================================
router.use('/auth', adminAuthRouter);

// ============================================================
// Test routes (không cần auth — chỉ dùng cho dev)
// ============================================================
import { BOSS_BATTLE_SOCKET_EVENTS, BOSS_BATTLE_ROOM_PREFIX } from '@uniclub/shared';
import { getIO } from '../../sockets/index';

router.post('/boss-battle/test/emit-hp-update', (req: Request, res: Response) => {
  try {
    const { weekKey, gradeLevel, hitByName, hitPoints, progressPercent, totalPointsEarned, currentBossStateImg, status } = req.body;
    if (!weekKey || gradeLevel == null) {
      res.status(400).json({ error: 'weekKey and gradeLevel are required' });
      return;
    }
    const io = getIO();
    const room = `${BOSS_BATTLE_ROOM_PREFIX}:${weekKey}:${gradeLevel}`;
    const payload = {
      weekKey,
      gradeLevel: Number(gradeLevel),
      totalPointsEarned: totalPointsEarned ?? 0,
      progressPercent: progressPercent ?? 0,
      currentBossStateImg: currentBossStateImg ?? '/images/boss/1.webp',
      status: status ?? 'ACTIVE',
      hitBy: req.body.hitBy ?? 'test-user',
      hitByName: hitByName ?? 'Người chơi test',
      hitPoints: hitPoints ?? 50,
    };
    io.to(room).emit(BOSS_BATTLE_SOCKET_EVENTS.BOSS_HP_UPDATE, payload);
    res.json({ success: true, room, payload });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/boss-battle/test/emit-defeated', (req: Request, res: Response) => {
  try {
    const { weekKey, gradeLevel } = req.body;
    if (!weekKey || gradeLevel == null) {
      res.status(400).json({ error: 'weekKey and gradeLevel are required' });
      return;
    }
    const io = getIO();
    const room = `${BOSS_BATTLE_ROOM_PREFIX}:${weekKey}:${gradeLevel}`;
    const payload = { weekKey, gradeLevel: Number(gradeLevel), defeatedAt: new Date().toISOString() };
    io.to(room).emit(BOSS_BATTLE_SOCKET_EVENTS.BOSS_DEFEATED, payload);
    res.json({ success: true, room, payload });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Áp dụng middleware cho tất cả routes bên dưới
// ============================================================
router.use(requireAdminAuth);

// ============================================================
// Mount game-group admin routes
// ============================================================

/** Boss Battle (Săn Boss) */
router.use('/boss-battle', bossBattleAdminRouter);

/** Weekly Event (Sự kiện tuần) */
router.use('/weekly-event', weeklyEventAdminRouter);

/** Analytics (KPI Dashboard) */
router.use('/analytics', analyticsAdminRouter);

// ============================================================
// Game Config Management (CMS)
// ============================================================

/** Lấy tất cả config */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const [gomoku, cardFlip, quizArena, bossBattle] = await Promise.all([
      GameConfigService.getGomokuConfig(),
      GameConfigService.getCardFlipConfig(),
      GameConfigService.getQuizArenaConfig(),
      GameConfigService.getBossBattleConfig(),
    ]);

    res.json({
      success: true,
      configs: {
        mind_game: {
          gomoku,
          card_flip: cardFlip,
        },
        quiz_arena: quizArena,
        boss_battle: bossBattle,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Cập nhật config Gomoku */
router.put('/config/gomoku', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    await GameConfigService.updateConfig('gomoku', config);
    res.json({ success: true, message: 'Gomoku config updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Cập nhật config Card Flip */
router.put('/config/card-flip', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    await GameConfigService.updateConfig('card_flip', config);
    res.json({ success: true, message: 'Card Flip config updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Cập nhật config Quiz Arena */
router.put('/config/quiz-arena', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    await GameConfigService.updateConfig('quiz_arena', config);
    res.json({ success: true, message: 'Quiz Arena config updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Invalidate cache */
router.post('/config/invalidate-cache', async (req: Request, res: Response) => {
  try {
    const { gameType } = req.body;
    await GameConfigService.invalidateCache(gameType);
    res.json({ success: true, message: `Cache invalidated for ${gameType}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Quiz Arena — Question Management
// ============================================================

/**
 * POST /api/admin/quiz-arena/recompute-difficulty
 * Bulk recompute độ khó tất cả câu hỏi dựa trên dữ liệu thực tế.
 */
router.post('/quiz-arena/recompute-difficulty', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getQuizArenaConfig();
    const count = await QuestionService.recomputeAllDifficulty(
      config.easyQuestionThreshold,
      config.hardQuestionThreshold,
    );
    res.json({ success: true, message: `Recomputed difficulty for ${count} questions` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/quiz-arena/questions
 * Lấy danh sách câu hỏi với filter và phân trang
 */
router.get('/quiz-arena/questions', async (req: Request, res: Response) => {
  try {
    const grade = req.query.grade ? parseInt(req.query.grade as string) : undefined;
    const difficultyBucket = req.query.difficulty as any;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await QuestionService.listQuestions({
      grade,
      difficultyBucket,
      search,
      page,
      pageSize,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/quiz-arena/questions/:id
 * Lấy câu hỏi theo ID
 */
router.get('/quiz-arena/questions/:id', async (req: Request, res: Response) => {
  try {
    const question = await QuestionService.getById(req.params.id);
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ success: true, question });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/quiz-arena/questions
 * Tạo câu hỏi mới
 */
router.post('/quiz-arena/questions', async (req: Request, res: Response) => {
  try {
    const { grade, content, options, correctIndex, timeLimitSeconds } = req.body;

    // Validate
    if (!grade || grade < 1 || grade > 12) {
      res.status(400).json({ error: 'grade phải từ 1-12' });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ error: 'content không được rỗng' });
      return;
    }
    if (!options || options.length !== 4) {
      res.status(400).json({ error: 'options phải có đúng 4 phần tử' });
      return;
    }
    if (correctIndex < 0 || correctIndex > 3) {
      res.status(400).json({ error: 'correctIndex phải từ 0-3' });
      return;
    }
    if (!timeLimitSeconds || timeLimitSeconds < 5) {
      res.status(400).json({ error: 'timeLimitSeconds phải >= 5' });
      return;
    }

    const question = await QuestionService.createQuestion({
      grade,
      content,
      options,
      correctIndex,
      timeLimitSeconds,
    });

    res.status(201).json({ success: true, question });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/quiz-arena/questions/:id
 * Cập nhật câu hỏi
 */
router.put('/quiz-arena/questions/:id', async (req: Request, res: Response) => {
  try {
    const { grade, content, options, correctIndex, timeLimitSeconds } = req.body;
    const updates: Record<string, any> = {};

    if (grade !== undefined) {
      if (grade < 1 || grade > 12) {
        res.status(400).json({ error: 'grade phải từ 1-12' });
        return;
      }
      updates.grade = grade;
    }
    if (content !== undefined) {
      if (!content.trim()) {
        res.status(400).json({ error: 'content không được rỗng' });
        return;
      }
      updates.content = content;
    }
    if (options !== undefined) {
      if (options.length !== 4) {
        res.status(400).json({ error: 'options phải có đúng 4 phần tử' });
        return;
      }
      updates.options = options;
    }
    if (correctIndex !== undefined) {
      if (correctIndex < 0 || correctIndex > 3) {
        res.status(400).json({ error: 'correctIndex phải từ 0-3' });
        return;
      }
      updates.correctIndex = correctIndex;
    }
    if (timeLimitSeconds !== undefined) {
      if (timeLimitSeconds < 5) {
        res.status(400).json({ error: 'timeLimitSeconds phải >= 5' });
        return;
      }
      updates.timeLimitSeconds = timeLimitSeconds;
    }

    const question = await QuestionService.updateQuestion(req.params.id, updates);
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    res.json({ success: true, question });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/quiz-arena/questions/:id
 * Xóa câu hỏi
 */
router.delete('/quiz-arena/questions/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await QuestionService.deleteQuestion(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ success: true, message: 'Question deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/quiz-arena/questions/bulk
 * Bulk create câu hỏi (cho Excel import)
 */
router.post('/quiz-arena/questions/bulk', async (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'questions array is required' });
      return;
    }

    const result = await QuestionService.bulkCreateQuestions(questions);
    res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/quiz-arena/questions/bulk-upsert
 * Bulk upsert câu hỏi (có id thì update, không có id thì create)
 */
router.post('/quiz-arena/questions/bulk-upsert', async (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'questions array is required' });
      return;
    }

    const result = await QuestionService.bulkUpsertQuestions(questions);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Score Management
// ============================================================

/** Lấy toàn bộ leaderboard (admin) */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const scope = (req.query.scope as string) || 'total';
    const leaderboard = await ScoreService.getLeaderboard(scope as any, limit);
    res.json({ success: true, leaderboard, scope });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Force sync leaderboard từ MongoDB → Redis */
router.post('/leaderboard/sync', async (req: Request, res: Response) => {
  try {
    const scope = (req.body.scope as string) || 'total';
    await ScoreService.syncLeaderboardFromDB(scope as any);
    res.json({ success: true, message: `Leaderboard synced for scope: ${scope}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Bot Profile Management (AI Bot Pool)
// ============================================================

/** Lấy tất cả bot profiles (bao gồm cả inactive) */
router.get('/bot-profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await BotProfileService.getAll();
    res.json({ success: true, profiles, count: profiles.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Lấy bot profile theo ID */
router.get('/bot-profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await BotProfileService.getById(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Bot profile not found' });
      return;
    }
    res.json({ success: true, profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Tạo bot profile mới */
router.post('/bot-profiles', async (req: Request, res: Response) => {
  try {
    const input: CreateBotProfileInput = req.body;
    if (!input.name || !input.avatar) {
      res.status(400).json({ error: 'name and avatar are required' });
      return;
    }
    const profile = await BotProfileService.create(input);
    res.status(201).json({ success: true, profile });
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error (unique constraint)
      res.status(409).json({ error: 'Bot name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

/** Tạo nhiều bot profiles cùng lúc (bulk) */
router.post('/bot-profiles/bulk', async (req: Request, res: Response) => {
  try {
    const inputs: CreateBotProfileInput[] = req.body.profiles;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      res.status(400).json({ error: 'profiles array is required' });
      return;
    }
    const profiles = await BotProfileService.createMany(inputs);
    res.status(201).json({ success: true, profiles, count: profiles.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Cập nhật bot profile */
router.put('/bot-profiles/:id', async (req: Request, res: Response) => {
  try {
    const input: UpdateBotProfileInput = req.body;
    const profile = await BotProfileService.update(req.params.id, input);
    if (!profile) {
      res.status(404).json({ error: 'Bot profile not found' });
      return;
    }
    res.json({ success: true, profile });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'Bot name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

/** Toggle trạng thái active của bot */
router.patch('/bot-profiles/:id/toggle-active', async (req: Request, res: Response) => {
  try {
    const profile = await BotProfileService.toggleActive(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Bot profile not found' });
      return;
    }
    res.json({ success: true, profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Xóa bot profile */
router.delete('/bot-profiles/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await BotProfileService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Bot profile not found' });
      return;
    }
    res.json({ success: true, message: 'Bot profile deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Refresh bot profiles cache (force reload từ MongoDB) */
router.post('/bot-profiles/refresh-cache', async (_req: Request, res: Response) => {
  try {
    const profiles = await BotProfileService.refreshCache();
    res.json({ success: true, message: 'Bot profiles cache refreshed', count: profiles.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Seed default bots (nếu collection rỗng) */
router.post('/bot-profiles/seed', async (_req: Request, res: Response) => {
  try {
    await BotProfileService.seedDefaultBots();
    const profiles = await BotProfileService.getAll();
    res.json({ success: true, message: 'Default bots seeded', count: profiles.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
