// ============================================================
// Mind Game — REST Routes
// ============================================================

import { Router, Request, Response } from 'express';
import { GomokuService } from '../services/gomoku.service';
import { CardFlipService } from '../services/card-flip.service';
import { MatchmakingService } from '../../../services/matchmaking.service';
import { getIO } from '../../../sockets/index';
import { MIND_GAME_SOCKET_EVENTS } from '@uniclub/shared';

const router = Router();

// ============================================================
// Gomoku (Cờ Caro) — gameplay đi qua Socket.IO (xem ../sockets/index.ts).
// REST chỉ giữ lại endpoint lấy session (dùng khi reload trang).
// ============================================================

/** Lấy session Gomoku */
router.get('/gomoku/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await GomokuService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    // serverNow: client dùng để hiệu chỉnh lệch đồng hồ khi tính thời gian ván
    res.json({ success: true, session, serverNow: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Card Flip (Lật thẻ PvP)
// ============================================================

/** Tạo session Card Flip vs AI */
router.post('/card-flip/start-vs-ai', async (req: Request, res: Response) => {
  try {
    const { userId, difficulty, mode } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const session = await CardFlipService.createAISession(
      userId,
      difficulty ?? 'medium',
      mode === 'advanced' ? 'advanced' : 'basic',
    );
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Lật thẻ */
router.post('/card-flip/flip', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, cardId } = req.body;
    if (!sessionId || !userId || cardId === undefined) {
      res.status(400).json({ error: 'sessionId, userId, cardId are required' });
      return;
    }

    const result = await CardFlipService.flipCard(sessionId, userId, cardId);

    // Broadcast updated state to all players in the session room
    const io = getIO();
    io.to(sessionId).emit(
      MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE,
      CardFlipService.statePayload(result.session, result.isMatch),
    );

    if (result.gameOver) {
      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
        winner: result.winner ?? null,
        isDraw: !result.winner,
        session: result.session,
      });
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** Reset thẻ không match (gọi sau khi client hiển thị animation) */
router.post('/card-flip/reset-flipped', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const session = await CardFlipService.resetFlipped(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const io = getIO();
    io.to(sessionId).emit(
      MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE,
      CardFlipService.statePayload(session, false),
    );

    res.json({ success: true, session });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** Lấy session Card Flip */
router.get('/card-flip/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await CardFlipService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    // serverNow: client dùng để hiệu chỉnh lệch đồng hồ khi tính thời gian ván
    res.json({ success: true, session, serverNow: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Active Session Check — kiểm tra user có session đang chơi
// ============================================================

/**
 * GET /api/game/mind-game/active-session/:userId
 * Kiểm tra user có session đang diễn ra không (gomoku hoặc card_flip).
 * Frontend gọi khi vào matchmaking page để tự động reconnect nếu có.
 */
router.get('/active-session/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check active session từ Redis key
    const active = await MatchmakingService.getActiveSession(userId);
    if (!active) {
      res.json({ success: true, hasActiveSession: false });
      return;
    }

    // Verify session vẫn tồn tại và đang playing
    let session = null;
    if (active.gameType === 'gomoku') {
      session = await GomokuService.getSession(active.sessionId);
    } else if (active.gameType === 'card_flip') {
      session = await CardFlipService.getSession(active.sessionId);
    }

    if (!session || session.status !== 'playing') {
      // Session đã kết thúc hoặc không tồn tại — clear stale key
      await MatchmakingService.clearActiveSession(userId);
      res.json({ success: true, hasActiveSession: false });
      return;
    }

    // Trả về thông tin session để frontend reconnect
    res.json({
      success: true,
      hasActiveSession: true,
      sessionId: active.sessionId,
      gameType: active.gameType,
      isBot: session.isAI,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
