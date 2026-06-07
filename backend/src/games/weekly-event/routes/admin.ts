// ============================================================
// Weekly Event — Admin REST Routes (/api/admin/weekly-event)
// Mount sau requireAdminAuth ở admin/index.ts
// ============================================================

import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../../../middleware/index';
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

// ============================================================
// Exam Bank CRUD
// ============================================================

/** GET /api/admin/weekly-event/exams */
router.get('/exams', async (req: Request, res: Response) => {
  try {
    const { grade, subject, search, page, pageSize } = req.query;
    const result = await ExamBankService.listExams({
      grade: grade ? parseInt(grade as string) : undefined,
      subject: subject as string | undefined,
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
    if (!input.grade || !input.title || !input.subject || !input.questions?.length) {
      res.status(400).json({ error: 'Missing required fields: grade, title, subject, questions' });
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
        if (!input.grade || !input.title || !input.subject || !input.questions?.length) {
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
