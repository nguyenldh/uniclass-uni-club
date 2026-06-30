// ============================================================
// Quiz Arena — REST Routes
// Phục vụ: lấy session, lấy config public
// Gameplay đi qua Socket.IO (xem ../sockets/index.ts)
// ============================================================

import { Router, Request, Response } from 'express';
import { QuizArenaService } from '../services/quiz-arena.service';
import { QuestionService } from '../services/question.service';
import { MatchmakingService } from '../../../services/matchmaking.service';

const router = Router();

// ---- Active Session Check ----

/**
 * GET /api/game/quiz-arena/active-session/:userId
 * Kiểm tra user có session đang diễn ra không.
 * Frontend gọi khi vào page quiz-arena để tự động reconnect nếu có.
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
    const session = await QuizArenaService.getSession(active.sessionId);
    if (!session || (session.status !== 'playing' && session.status !== 'waiting')) {
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
      isBot: session.isBot,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Has Questions Check (trước khi ghép trận) ----

/**
 * GET /api/game/quiz-arena/has-questions/:grade
 * Kiểm tra khối lớp đã có câu hỏi chưa.
 * Frontend gọi TRƯỚC khi bắt đầu ghép trận — nếu chưa có câu hỏi thì hiển thị
 * màn "không có câu hỏi" thay vì vào ghép trận rồi mới báo.
 * PHẢI khai báo trước route '/:sessionId' để không bị nuốt bởi param động.
 */
router.get('/has-questions/:grade', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(req.params.grade, 10);
    if (Number.isNaN(grade)) {
      res.status(400).json({ error: 'Invalid grade' });
      return;
    }
    const hasQuestions = await QuestionService.hasQuestionsForGrade(grade);
    res.json({ success: true, hasQuestions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Session ----

/**
 * GET /api/game/quiz-arena/:sessionId
 * Lấy session (dùng khi reload trang).
 * Loại bỏ correctIndex của câu hỏi chưa kết thúc.
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await QuizArenaService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Ẩn correctIndex với các câu chưa kết thúc
    const currentIdx = session.currentQuestionIndex;
    const sanitizedQuestions = session.questions.map((q, idx) => {
      if (session.status === 'playing' && idx >= currentIdx) {
        const { correctIndex: _omit, ...rest } = q;
        return rest;
      }
      return q;
    });

    res.json({ success: true, session: { ...session, questions: sanitizedQuestions } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
