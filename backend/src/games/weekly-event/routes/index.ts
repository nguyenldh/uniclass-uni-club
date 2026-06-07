// ============================================================
// Weekly Event — Student REST Routes (/api/game/weekly-event)
// ============================================================

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/index';
import { normalizeAuthUser } from '@uniclub/shared';
import { requireUserAuth } from '../../../middleware/index';
import { WeeklyEventParticipationModel, WeeklyEventModel, WeeklyEventRoomModel } from '../../../models/index';
import { WeeklyEventService } from '../services/weekly-event.service';
import { WeeklyEventRoomService } from '../services/weekly-event-room.service';
import { WeeklyEventGradingService } from '../services/weekly-event-grading.service';
import { WeeklyEventSocketService } from '../services/weekly-event-socket.service';

const router = Router();

/**
 * GET /api/game/weekly-event/current
 * Lấy event đang diễn ra (cho UI-S-001).
 */
router.get('/current', async (req: Request, res: Response) => {
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

      // Tìm event gần nhất vừa kết thúc (status = 'Closed')
      const lastClosedEvent = await WeeklyEventModel.findOne({ status: 'Closed' })
        .sort({ scheduledStartAt: -1 })
        .lean();

      res.json({
        success: true,
        event: null,
        status: 'closed',
        nextEventAt,
        lastEvent: lastClosedEvent
          ? {
              _id: String(lastClosedEvent._id),
              title: lastClosedEvent.title,
            }
          : null,
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

    // Kiểm tra xem user hiện tại đã tham gia room chưa (nếu có gửi token trong header)
    let hasJoined = false;
    let roomId: string | undefined;
    let socketToken: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const rawPayload = jwt.verify(token, env.JWT_SECRET);
        const payload = normalizeAuthUser(rawPayload);
        const userId = payload.profileId ? String(payload.profileId) : payload.userId;

        if (userId) {
          const participation = await WeeklyEventParticipationModel.findOne({
            eventId: String(event._id),
            studentId: userId,
          }).lean();

          if (participation) {
            hasJoined = true;
            roomId = String(participation.roomId);
            const pGrade = participation.grade || payload.grade || 5;
            socketToken = WeeklyEventSocketService.createSocketToken(userId, String(event._id), pGrade);
          }
        }
      } catch (err) {
        // Hết hạn/sai token thì bỏ qua (khách vãng lai)
      }
    }

    res.json({
      success: true,
      event,
      status: uiStatus,
      hasJoined,
      roomId,
      socketToken,
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

    if (!Number.isFinite(grade) || grade <= 0 || grade > 12) {
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
      req.user!.grade,
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

/**
 * GET /api/game/weekly-event/leaderboard/:eventId/:grade
 * Lấy leaderboard snapshot của một event và khối lớp cụ thể.
 */
router.get('/leaderboard/:eventId/:grade', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { eventId, grade: gradeStr } = req.params;
    const grade = parseInt(gradeStr, 10);
    if (!Number.isFinite(grade) || grade <= 0 || grade > 12) {
      res.status(400).json({ error: 'Grade không hợp lệ' });
      return;
    }

    const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
    if (!room) {
      res.status(404).json({ error: 'Không tìm thấy phòng thi cho khối lớp này' });
      return;
    }

    const leaderboard = await WeeklyEventGradingService.getLeaderboardSnapshot(
      eventId,
      String(room._id)
    );

    res.json({
      success: true,
      leaderboard: leaderboard || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
