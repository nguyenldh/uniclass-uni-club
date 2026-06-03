// ============================================================
// Boss Battle — Admin REST (/api/admin/boss-battle/*)
// Mount sau requireAdminAuth ở admin/index.ts
// ============================================================

import { Router, Request, Response } from 'express';
import {
  BossQuestionService,
  QuestionSetService,
  WeeklyCycleService,
  LeaderboardService,
  BossBattleService,
  BossWeeklyConfigService,
} from '../services/index';
import { GameConfigService } from '../../../services/game-config.service';
import { DEFAULT_BOSS_BATTLE_CONFIG, BOSS_BATTLE_HONOR_TOP_N } from '@uniclub/shared';
import type { BossBattleConfig } from '@uniclub/shared';

const router = Router();

// ---- Config ----

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getBossBattleConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const incoming = req.body as Partial<BossBattleConfig>;
    const merged: BossBattleConfig = {
      ...DEFAULT_BOSS_BATTLE_CONFIG,
      ...incoming,
      bossStates: incoming?.bossStates ?? DEFAULT_BOSS_BATTLE_CONFIG.bossStates,
    };

    // Validate cơ bản
    if (!Number.isFinite(merged.hpMax) || merged.hpMax <= 0) {
      res.status(400).json({ error: 'hpMax must be > 0' });
      return;
    }
    if (!Number.isFinite(merged.questionsPerDay) || merged.questionsPerDay <= 0) {
      res.status(400).json({ error: 'questionsPerDay must be > 0' });
      return;
    }
    if (!Number.isFinite(merged.questionsPerWeek) || merged.questionsPerWeek <= 0) {
      res.status(400).json({ error: 'questionsPerWeek must be > 0' });
      return;
    }
    if (!Array.isArray(merged.bossStates) || merged.bossStates.length === 0) {
      res.status(400).json({ error: 'bossStates must have at least one entry' });
      return;
    }

    await GameConfigService.updateConfig('boss_battle', merged);
    res.json({ success: true, config: merged });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- BossQuestion CRUD ----

router.get('/questions', async (req: Request, res: Response) => {
  try {
    const grade = req.query.grade ? parseInt(req.query.grade as string, 10) : undefined;
    const isActive =
      req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const search = (req.query.search as string) || undefined;
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
    const result = await BossQuestionService.list({ grade, isActive, search, page, pageSize });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/questions/by-ids', async (req: Request, res: Response) => {
  try {
    const ids: unknown = req.body?.ids;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
      res.status(400).json({ error: 'ids must be string[]' });
      return;
    }
    const items = await BossQuestionService.getByIds(ids as string[]);
    res.json({ success: true, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/questions/:id', async (req: Request, res: Response) => {
  try {
    const q = await BossQuestionService.getById(req.params.id);
    if (!q) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ success: true, question: q });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/questions', async (req: Request, res: Response) => {
  try {
    const { grade, content, imageUrl, options, correctIndex, isActive } = req.body ?? {};
    if (!grade || grade < 1 || grade > 12) {
      res.status(400).json({ error: 'grade must be 1..12' });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ error: 'content required' });
      return;
    }
    if (!Array.isArray(options) || options.length !== 4) {
      res.status(400).json({ error: 'options must have 4 items' });
      return;
    }
    if (correctIndex == null || correctIndex < 0 || correctIndex > 3) {
      res.status(400).json({ error: 'correctIndex must be 0..3' });
      return;
    }
    const q = await BossQuestionService.create({
      grade,
      content: String(content).trim(),
      imageUrl,
      options: options as [string, string, string, string],
      correctIndex,
      isActive,
    });
    res.status(201).json({ success: true, question: q });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/questions/:id', async (req: Request, res: Response) => {
  try {
    const q = await BossQuestionService.update(req.params.id, req.body ?? {});
    if (!q) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ success: true, question: q });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/questions/:id', async (req: Request, res: Response) => {
  try {
    const ok = await BossQuestionService.remove(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/questions/bulk', async (req: Request, res: Response) => {
  try {
    const questions = req.body?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'questions array required' });
      return;
    }
    const result = await BossQuestionService.bulkCreate(questions);
    res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/questions/bulk-upsert', async (req: Request, res: Response) => {
  try {
    const questions = req.body?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'questions array required' });
      return;
    }
    const result = await BossQuestionService.bulkUpsert(questions);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- QuestionSet ----

router.get('/question-sets', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.query.weekKey || '');
    const grade = parseInt((req.query.grade as string) || '0', 10);
    if (!weekKey || !grade) {
      res.status(400).json({ error: 'Missing weekKey/grade' });
      return;
    }
    const sets = await QuestionSetService.list(weekKey, grade);
    res.json({ success: true, sets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/question-sets/auto-generate', async (req: Request, res: Response) => {
  try {
    const { weekKey, gradeLevel, force } = req.body ?? {};
    if (!weekKey || !gradeLevel) {
      res.status(400).json({ error: 'Missing weekKey/gradeLevel' });
      return;
    }
    const result = await QuestionSetService.autoGenerate(
      String(weekKey),
      Number(gradeLevel),
      Boolean(force),
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/question-sets/:setId/swap', async (req: Request, res: Response) => {
  try {
    const { oldQuestionId, newQuestionId } = req.body ?? {};
    if (!oldQuestionId || !newQuestionId) {
      res.status(400).json({ error: 'Missing oldQuestionId/newQuestionId' });
      return;
    }
    const set = await QuestionSetService.swapQuestion(
      req.params.setId,
      String(oldQuestionId),
      String(newQuestionId),
    );
    if (!set) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    res.json({ success: true, set });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ---- Cycle ----

router.post('/cycle/init-week', async (req: Request, res: Response) => {
  try {
    const { weekKey, grades } = req.body ?? {};
    if (!weekKey) {
      res.status(400).json({ error: 'Missing weekKey' });
      return;
    }
    const result = await WeeklyCycleService.initWeek(
      String(weekKey),
      Array.isArray(grades) && grades.length > 0 ? grades.map(Number) : undefined,
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/cycle/close-week', async (req: Request, res: Response) => {
  try {
    const { weekKey, topN } = req.body ?? {};
    if (!weekKey) {
      res.status(400).json({ error: 'Missing weekKey' });
      return;
    }
    const result = await WeeklyCycleService.closeWeek(
      String(weekKey),
      Number(topN) || BOSS_BATTLE_HONOR_TOP_N,
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/cycle/expire-honors', async (_req: Request, res: Response) => {
  try {
    const result = await WeeklyCycleService.expireHonors();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Monitor ----

router.get('/instances', async (req: Request, res: Response) => {
  try {
    const weekKey = (req.query.weekKey as string) || undefined;
    const data = await BossBattleService.getInstanceMonitor(weekKey);
    res.json({ success: true, instances: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.query.weekKey || '');
    const grade = parseInt((req.query.grade as string) || '0', 10);
    if (!weekKey || !grade) {
      res.status(400).json({ error: 'Missing weekKey/grade' });
      return;
    }
    const data = await LeaderboardService.getLeaderboard(weekKey, grade);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/honors', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.query.weekKey || '');
    const grade = req.query.grade ? parseInt(req.query.grade as string, 10) : undefined;
    if (!weekKey) {
      res.status(400).json({ error: 'Missing weekKey' });
      return;
    }
    const honors = await WeeklyCycleService.getHonorsByWeek(weekKey, grade);
    res.json({ success: true, honors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Weekly Config (override theo tuần × khối) ----

router.get('/weekly-config/initialized-weeks', async (_req: Request, res: Response) => {
  try {
    const weeks = await BossWeeklyConfigService.listInitializedWeeks();
    res.json({ success: true, weeks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly-config', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.query.weekKey || '').trim();
    if (!weekKey) {
      res.status(400).json({ error: 'Missing weekKey' });
      return;
    }
    const gradesParam = (req.query.grades as string) || '';
    const grades = gradesParam
      ? gradesParam
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    const items = await BossWeeklyConfigService.listByWeek(weekKey, grades);
    res.json({ success: true, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly-config/:weekKey/:gradeLevel', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.params.weekKey || '').trim();
    const gradeLevel = parseInt(req.params.gradeLevel, 10);
    if (!weekKey || !Number.isFinite(gradeLevel)) {
      res.status(400).json({ error: 'Invalid weekKey/gradeLevel' });
      return;
    }
    const item = await BossWeeklyConfigService.getByKey(weekKey, gradeLevel);
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/weekly-config/:weekKey/:gradeLevel', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.params.weekKey || '').trim();
    const gradeLevel = parseInt(req.params.gradeLevel, 10);
    if (!weekKey || !Number.isFinite(gradeLevel)) {
      res.status(400).json({ error: 'Invalid weekKey/gradeLevel' });
      return;
    }
    const overrides = req.body?.overrides;
    if (!overrides || typeof overrides !== 'object') {
      res.status(400).json({ error: 'overrides object required' });
      return;
    }
    const item = await BossWeeklyConfigService.upsert(weekKey, gradeLevel, overrides);
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/weekly-config/:weekKey/:gradeLevel', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.params.weekKey || '').trim();
    const gradeLevel = parseInt(req.params.gradeLevel, 10);
    if (!weekKey || !Number.isFinite(gradeLevel)) {
      res.status(400).json({ error: 'Invalid weekKey/gradeLevel' });
      return;
    }
    const removed = await BossWeeklyConfigService.remove(weekKey, gradeLevel);
    res.json({ success: true, removed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/weekly-config/copy', async (req: Request, res: Response) => {
  try {
    const { sourceWeekKey, targetWeekKey, grades, overwrite } = req.body ?? {};
    if (!sourceWeekKey || !targetWeekKey) {
      res.status(400).json({ error: 'sourceWeekKey/targetWeekKey required' });
      return;
    }
    const gradeList = Array.isArray(grades)
      ? grades.map((g) => Number(g)).filter((n) => Number.isFinite(n))
      : undefined;
    const written = await BossWeeklyConfigService.copyFromWeek(
      String(sourceWeekKey).trim(),
      String(targetWeekKey).trim(),
      gradeList,
      Boolean(overwrite),
    );
    res.json({ success: true, written });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
