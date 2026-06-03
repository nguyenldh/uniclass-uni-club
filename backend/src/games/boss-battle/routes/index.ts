// ============================================================
// Boss Battle — Game REST Routes (/api/game/boss-battle)
// Yêu cầu requireUserAuth — userId & gradeLevel lấy từ JWT WebView.
// ============================================================

import { Router, Request, Response } from 'express';
import { requireUserAuth } from '../../../middleware/index';
import {
  BossBattleService,
  LeaderboardService,
  WeeklyCycleService,
} from '../services/index';
import { GameConfigService } from '../../../services/game-config.service';
import { formatWeekKey } from '../utils/week';

const router = Router();

router.use(requireUserAuth);

/** GET /api/game/boss-battle/config — public config (read-only) */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getBossBattleConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/game/boss-battle/lobby?grade=X */
router.get('/lobby', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(String(req.query.grade ?? req.user!.grade ?? '0'), 10);
    if (!Number.isFinite(grade) || grade <= 0) {
      res.status(400).json({ error: 'Missing grade' });
      return;
    }
    const data = await BossBattleService.getLobby(req.user!.userId, grade);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/game/boss-battle/battle/start  body: { grade } */
router.post('/battle/start', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(String(req.body?.grade ?? req.user!.grade ?? '0'), 10);
    if (!Number.isFinite(grade) || grade <= 0) {
      res.status(400).json({ error: 'Missing grade' });
      return;
    }
    const data = await BossBattleService.startBattle(req.user!.userId, grade);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/game/boss-battle/battle/answer  body: BossAnswerPayload */
router.post('/battle/answer', async (req: Request, res: Response) => {
  try {
    const { attemptId, questionId, selectedIndex } = req.body ?? {};
    if (!attemptId || !questionId) {
      res.status(400).json({ error: 'Missing attemptId/questionId' });
      return;
    }
    
    const data = await BossBattleService.submitAnswer({
      studentId: req.user!.userId,
      attemptId: String(attemptId),
      questionId: String(questionId),
      selectedIndex: selectedIndex === null || selectedIndex === undefined ? null : Number(selectedIndex),
    });
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /api/game/boss-battle/attempt/:id/result */
router.get('/attempt/:id/result', async (req: Request, res: Response) => {
  try {
    const data = await BossBattleService.getAttemptResult(req.user!.userId, req.params.id);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /api/game/boss-battle/leaderboard?weekKey=&grade=&limit= */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const weekKey = String(req.query.weekKey || formatWeekKey());
    const grade = parseInt(String(req.query.grade ?? req.user!.grade ?? '0'), 10);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    if (!Number.isFinite(grade) || grade <= 0) {
      res.status(400).json({ error: 'Missing grade' });
      return;
    }
    const data = await LeaderboardService.getLeaderboard(weekKey, grade, req.user!.userId, limit);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/game/boss-battle/honor/current?grade= */
router.get('/honor/current', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(String(req.query.grade ?? req.user!.grade ?? '0'), 10);
    if (!Number.isFinite(grade) || grade <= 0) {
      res.status(400).json({ error: 'Missing grade' });
      return;
    }
    const honors = await WeeklyCycleService.getCurrentHonors(grade);
    res.json({ success: true, honors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
