// ============================================================
// Weekly Event — Admin REST Routes (/api/admin/weekly-event)
// Mount sau requireAdminAuth ở admin/index.ts
// ============================================================

import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../../../middleware/index';
import {
  WeeklyEventRoomModel,
  WeeklyEventParticipationModel,
  WeeklyEventResultModel,
  UserModel,
  ExamBankModel,
} from '../../../models/index';
import {
  WeeklyEventConfigService,
  ExamBankService,
  WeeklyEventService,
} from '../services/index';
import type {
  CreateExamInput,
  UpdateExamInput,
  CreateEventInput,
  UpdateEventInput,
  AssignExamInput,
  UpdateGeneralConfigInput,
} from '@uniclub/shared';

const router = Router();

// ============================================================
// General Config
// ============================================================

/** GET /api/admin/weekly-event/general-config */
router.get('/general-config', async (_req: Request, res: Response) => {
  try {
    const config = await WeeklyEventConfigService.getGeneralConfig();
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /api/admin/weekly-event/general-config */
router.put('/general-config', async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateGeneralConfigInput;
    const adminId = req.admin?.adminId || 'unknown';
    const config = await WeeklyEventConfigService.updateGeneralConfig(input, adminId);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Events CRUD
// ============================================================

/** GET /api/admin/weekly-event/events */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { status, weekNumber, year, page, pageSize } = req.query;
    const result = await WeeklyEventService.listEvents({
      status: status as any,
      weekNumber: weekNumber ? parseInt(weekNumber as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/events/:id */
router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const event = await WeeklyEventService.getEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/events */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateEventInput;
    if (!input.weekNumber || !input.year || !input.title || !input.scheduledStartAt) {
      res.status(400).json({ error: 'Missing required fields: weekNumber, year, title, scheduledStartAt' });
      return;
    }
    const event = await WeeklyEventService.createEvent(input, req.admin?.adminId);
    res.status(201).json({ success: true, event });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /api/admin/weekly-event/events/:id */
router.put('/events/:id', async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateEventInput;
    const event = await WeeklyEventService.updateEvent(req.params.id, input);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/events/:id/publish */
router.post('/events/:id/publish', async (req: Request, res: Response) => {
  try {
    const event = await WeeklyEventService.publishEvent(req.params.id);
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/events/:id/cancel */
router.post('/events/:id/cancel', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    const event = await WeeklyEventService.cancelEvent(req.params.id, reason || 'Admin cancelled');
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/events/:id/assign-exam */
router.post('/events/:id/assign-exam', async (req: Request, res: Response) => {
  try {
    const input = req.body as AssignExamInput;
    if (!input.grade || !input.examId) {
      res.status(400).json({ error: 'Missing grade or examId' });
      return;
    }
    const event = await WeeklyEventService.assignExam(req.params.id, input);
    res.json({ success: true, event });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/events/:id/rooms */
router.get('/events/:id/rooms', async (req: Request, res: Response) => {
  try {
    const rooms = await WeeklyEventService.getRooms(req.params.id);
    res.json({ success: true, rooms });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/events/:id/rooms/:grade/leaderboard */
router.get('/events/:id/rooms/:grade/leaderboard', async (req: Request, res: Response) => {
  try {
    const { id, grade } = req.params;
    const room = await WeeklyEventRoomModel.findOne({
      eventId: id,
      grade: parseInt(grade),
    }).lean();

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const results = await WeeklyEventResultModel.find({
      eventId: id,
      roomId: room._id,
    })
      .sort({ score: -1, totalTimeMs: 1 })
      .limit(50)
      .lean();

    const studentIds = results.map((r) => r.studentId);
    const users = await UserModel.find({ userId: { $in: studentIds } }).lean();
    const userMap = new Map(users.map((u) => [u.userId, u]));

    const leaderboard = results.map((r, idx) => ({
      rank: r.rank || idx + 1,
      studentId: r.studentId,
      displayName: userMap.get(r.studentId)?.name || r.studentId,
      avatarUrl: userMap.get(r.studentId)?.avatar,
      correctCount: r.correctCount,
      totalTimeMs: r.totalTimeMs,
      score: r.score,
    }));

    res.json({ success: true, leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/events/:id/rooms/:grade/participants */
router.get('/events/:id/rooms/:grade/participants', async (req: Request, res: Response) => {
  try {
    const { id, grade } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = req.query.search as string;

    const room = await WeeklyEventRoomModel.findOne({
      eventId: id,
      grade: parseInt(grade),
    }).lean();

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const filter: any = { eventId: id, roomId: room._id };

    if (search) {
      const matchedUsers = await UserModel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { userId: { $regex: search, $options: 'i' } },
        ],
      })
        .select('userId')
        .lean();
      const matchedUserIds = matchedUsers.map((u) => u.userId);
      filter.studentId = { $in: matchedUserIds };
    }

    const [participations, total] = await Promise.all([
      WeeklyEventParticipationModel.find(filter)
        .sort({ joinedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      WeeklyEventParticipationModel.countDocuments(filter),
    ]);

    const studentIds = participations.map((p) => p.studentId);
    const [users, results] = await Promise.all([
      UserModel.find({ userId: { $in: studentIds } }).lean(),
      WeeklyEventResultModel.find({
        eventId: id,
        roomId: room._id,
        studentId: { $in: studentIds },
      }).lean(),
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const resultMap = new Map(results.map((r) => [r.studentId, r]));

    const items = participations.map((p) => {
      const user = userMap.get(p.studentId);
      const result = resultMap.get(p.studentId);
      return {
        studentId: p.studentId,
        displayName: user?.name || p.studentId,
        avatarUrl: user?.avatar,
        joinedAt: p.joinedAt,
        examStartedAt: p.examStartedAt,
        submittedAt: p.submittedAt,
        submissionType: p.submissionType,
        disconnectCount: p.disconnectCount,
        isGraded: !!result,
        correctCount: result?.correctCount || 0,
        totalAnswered: result?.totalAnswered || 0,
        totalTimeMs: result?.totalTimeMs || 0,
        score: result?.score || 0,
        rank: result?.rank,
      };
    });

    res.json({
      success: true,
      items,
      total,
      page,
      pageSize,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/events/:id/rooms/:grade/participants/:studentId/answers */
router.get(
  '/events/:id/rooms/:grade/participants/:studentId/answers',
  async (req: Request, res: Response) => {
    try {
      const { id, grade, studentId } = req.params;

      const room = await WeeklyEventRoomModel.findOne({
        eventId: id,
        grade: parseInt(grade),
      }).lean();

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const result = await WeeklyEventResultModel.findOne({
        eventId: id,
        roomId: room._id,
        studentId: studentId,
      }).lean();

      if (!result) {
        res.status(404).json({ error: 'Result not found or student has not submitted yet' });
        return;
      }

      const exam = await ExamBankModel.findById(room.examId).lean();
      if (!exam) {
        res.status(404).json({ error: 'Exam not found for this room' });
        return;
      }

      const user = await UserModel.findOne({ userId: studentId }).lean();

      res.json({
        success: true,
        result: {
          studentId: result.studentId,
          displayName: user?.name || result.studentId,
          avatarUrl: user?.avatar,
          correctCount: result.correctCount,
          totalAnswered: result.totalAnswered,
          totalTimeMs: result.totalTimeMs,
          score: result.score,
          rank: result.rank,
        },
        answers: result.answers,
        exam: {
          title: exam.title,
          questions: exam.questions,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ============================================================
// Exam Bank CRUD
// ============================================================

/** GET /api/admin/weekly-event/exams */
router.get('/exams', async (req: Request, res: Response) => {
  try {
    const { grade, search, page, pageSize } = req.query;
    const result = await ExamBankService.listExams({
      grade: grade ? parseInt(grade as string) : undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/exams/by-grade/:grade */
router.get('/exams/by-grade/:grade', async (req: Request, res: Response) => {
  try {
    const grade = parseInt(req.params.grade);
    const exams = await ExamBankService.getExamsByGrade(grade);
    res.json({ success: true, exams });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/admin/weekly-event/exams/:id */
router.get('/exams/:id', async (req: Request, res: Response) => {
  try {
    const exam = await ExamBankService.getExamById(req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json({ success: true, exam });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/exams */
router.post('/exams', async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateExamInput;
    if (!input.grade || !input.title || !input.questions?.length) {
      res.status(400).json({ error: 'Missing required fields: grade, title, questions' });
      return;
    }
    const exam = await ExamBankService.createExam(input);
    res.status(201).json({ success: true, exam });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /api/admin/weekly-event/exams/:id */
router.put('/exams/:id', async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateExamInput;
    const exam = await ExamBankService.updateExam(req.params.id, input);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json({ success: true, exam });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** DELETE /api/admin/weekly-event/exams/:id */
router.delete('/exams/:id', async (req: Request, res: Response) => {
  try {
    const ok = await ExamBankService.deleteExam(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/admin/weekly-event/exams/bulk — import nhiều đề từ Excel */
router.post('/exams/bulk', async (req: Request, res: Response) => {
  try {
    const { exams } = req.body || {};
    if (!Array.isArray(exams) || exams.length === 0) {
      res.status(400).json({ error: 'exams array is required' });
      return;
    }

    let createdCount = 0;
    const errors: Array<{ index: number; title?: string; error: string }> = [];

    for (let i = 0; i < exams.length; i++) {
      try {
        const input = exams[i] as CreateExamInput;
        if (!input.grade || !input.title || !input.questions?.length) {
          errors.push({ index: i, title: input.title, error: 'Missing required fields' });
          continue;
        }
        if (input.questions.length !== 25) {
          errors.push({ index: i, title: input.title, error: `Expected 25 questions, got ${input.questions.length}` });
          continue;
        }
        await ExamBankService.createExam(input);
        createdCount++;
      } catch (err: any) {
        errors.push({ index: i, title: exams[i]?.title, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      createdCount,
      errorCount: errors.length,
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
