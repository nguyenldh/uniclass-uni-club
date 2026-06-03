// ============================================================
// Matchmaking REST Routes — game-agnostic
// ============================================================

import { Router, Request, Response } from 'express';
import { MatchmakingService } from '../../services/matchmaking.service';
import type { MatchmakingGameType } from '@uniclub/shared';

const router = Router();

/** Tham gia matchmaking */
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { userId, gameType, socketId } = req.body;
    if (!userId || !gameType) {
      res.status(400).json({ error: 'userId and gameType are required' });
      return;
    }

    const result = await MatchmakingService.joinQueue({
      userId,
      gameType: gameType as MatchmakingGameType,
      joinedAt: Date.now(),
      socketId: socketId ?? '',
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Rời matchmaking */
router.post('/leave', async (req: Request, res: Response) => {
  try {
    const { userId, gameType } = req.body;
    if (!userId || !gameType) {
      res.status(400).json({ error: 'userId and gameType are required' });
      return;
    }

    await MatchmakingService.leaveQueue(userId, gameType as MatchmakingGameType);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Lấy kích thước queue */
router.get('/queue-size/:gameType', async (req: Request, res: Response) => {
  try {
    const size = await MatchmakingService.getQueueSize(req.params.gameType as MatchmakingGameType);
    res.json({ success: true, size });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
