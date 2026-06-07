// ============================================================
// Weekly Event — Student REST Routes (/api/game/weekly-event)
// ============================================================

import { Router, Request, Response } from 'express';
import { requireUserAuth } from '../../../middleware/index';
import { WeeklyEventService } from '../services/weekly-event.service';
import { WeeklyEventRoomService } from '../services/weekly-event-room.service';
import { WeeklyEventGradingService } from '../services/weekly-event-grading.service';

const router = Router();

/**
 * GET /api/game/weekly-event/current
 * Lấy event đang diễn ra (cho UI-S-001).
 */
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const event = await WeeklyEventService.getCurrentEvent();

    if (!event) {
      // Tính thời gian đến event tiếp theo
      const nextEvent = await WeeklyEventService.listEvents({
        status: 'Scheduled',
        page: 1,
        pageSize: 1,
      });
      const nextEventAt = nextEvent.items[0]?.scheduledStartAt || null;

      res.json({
        success: true,
        event: null,
        status: 'closed',
        nextEventAt,
      });
      return;
    }

    // Xác định status cho UI
    let uiStatus: 'before-open' | 'open' | 'in-progress' | 'closed';
    switch (event.status) {
      case 'Scheduled':
        uiStatus = 'before-open';
        break;
      case 'Waiting':
        uiStatus = 'open';
        break;
      case 'InProgress':
      case 'Grading':
      case 'Showing':
        uiStatus = 'in-progress';
        break;
      default:
        uiStatus = 'closed';
    }

    res.json({
      success: true,
      event,
      status: uiStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/game/weekly-event/:eventId/join
 * FLOW-003 Pha 1: Học sinh join phòng chờ.
 * Yêu cầu auth — grade lấy từ JWT hoặc body.
 */
router.post('/:eventId/join', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const grade = parseInt(String(req.body?.grade ?? req.user!.grade ?? '0'), 10);

    if (!Number.isFinite(grade) || grade <= 0 || grade > 9) {
      res.status(400).json({ error: 'Missing or invalid grade (1-12)' });
      return;
    }

    const result = await WeeklyEventRoomService.joinRoom(
      eventId,
      req.user!.userId,
      grade,
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    const message = error.message;
    if (message === 'EVENT_LATE') {
      res.status(400).json({ error: 'Sự kiện đã bắt đầu, không thể tham gia muộn' });
      return;
    }
    if (message === 'EVENT_NOT_FOUND' || message === 'ROOM_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy sự kiện hoặc phòng thi' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/game/weekly-event/history/:studentId
 * Lịch sử kết quả các tuần.
 */
router.get('/history/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // Lấy danh sách kết quả của học sinh
    const { WeeklyEventResultModel } = await import('../../../models/index');
    const [results, total] = await Promise.all([
      WeeklyEventResultModel.find({ studentId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      WeeklyEventResultModel.countDocuments({ studentId }),
    ]);

    res.json({
      success: true,
      items: results.map((r: any) => ({
        eventId: String(r.eventId),
        correctCount: r.correctCount,
        totalAnswered: r.totalAnswered,
        totalTimeMs: r.totalTimeMs,
        rank: r.rank,
        score: r.score,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/game/weekly-event/result/:eventId
 * Lấy kết quả cá nhân của 1 event.
 */
router.get('/result/:eventId', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const result = await WeeklyEventGradingService.getPersonalResult(
      eventId,
      req.user!.userId,
    );

    if (!result) {
      res.status(404).json({ error: 'Không tìm thấy kết quả' });
      return;
    }

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
