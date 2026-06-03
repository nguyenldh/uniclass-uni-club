import { Router, Request, Response } from 'express';
import { ScoreService } from '../../services/score.service';
import { GameConfigService } from '../../services/game-config.service';
import mindGameRoutes from '../../games/mind-game/routes/index';
import quizArenaRoutes from '../../games/quiz-arena/routes/index';
import bossBattleRoutes from '../../games/boss-battle/routes/index';
import matchmakingRoutes from './matchmaking.routes';

const router = Router();

// ============================================================
// Mount game-group routes
// ============================================================

/** Mind Game (Đấu trí) — Gomoku & Card Flip */
router.use('/mind-game', mindGameRoutes);

/** Quiz Arena (So Tài) */
router.use('/quiz-arena', quizArenaRoutes);

/** Boss Battle (Săn Boss) */
router.use('/boss-battle', bossBattleRoutes);

/** Matchmaking — game-agnostic, dùng chung cho mọi game PvP */
router.use('/matchmaking', matchmakingRoutes);

// ============================================================
// Score & Leaderboard (common)
// ============================================================

/** Lấy điểm của user */
router.get('/score/:userId', async (req: Request, res: Response) => {
  try {
    const score = await ScoreService.getUserScore(req.params.userId);
    res.json({ success: true, score });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Bảng xếp hạng */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const scope = (req.query.scope as string) || 'total';
    const leaderboard = await ScoreService.getLeaderboard(scope as any, limit);
    res.json({ success: true, leaderboard, scope });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Config (public read)
// ============================================================

/** Lấy config Gomoku */
router.get('/config/gomoku', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getGomokuConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Lấy config Card Flip */
router.get('/config/card-flip', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getCardFlipConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Lấy config Quiz Arena */
router.get('/config/quiz-arena', async (_req: Request, res: Response) => {
  try {
    const config = await GameConfigService.getQuizArenaConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
