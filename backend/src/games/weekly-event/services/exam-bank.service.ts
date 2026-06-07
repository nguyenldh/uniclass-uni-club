// ============================================================
// Weekly Event — Exam Bank Service
// Quản lý ngân hàng đề thi (DATA-M-004)
// ============================================================

import { redis } from '../../../config/index';
import { ExamBankModel, WeeklyEventModel } from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_EXAM_CACHE_TTL,
  WEEKLY_EVENT_DEFAULT_QUESTION_COUNT,
} from '@uniclub/shared';
import type { ExamBank, CreateExamInput, UpdateExamInput } from '@uniclub/shared';
import crypto from 'crypto';

export class ExamBankService {
  /**
   * Lấy danh sách đề thi với filter & phân trang.
   */
  static async listExams(params: {
    grade?: number;
    subject?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ExamBank[]; total: number; page: number; pageSize: number }> {
    const { grade, subject, search, page = 1, pageSize = 20 } = params;
    const filter: Record<string, unknown> = {};
    if (grade) filter.grade = grade;
    if (subject) filter.subject = subject;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      ExamBankModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ExamBankModel.countDocuments(filter),
    ]);

    return {
      items: items.map(this.toExamBank),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Lấy danh sách đề theo khối (cho dropdown gán đề).
   */
  static async getExamsByGrade(grade: number): Promise<ExamBank[]> {
    const docs = await ExamBankModel.find({ grade }).sort({ createdAt: -1 }).lean();
    return docs.map(this.toExamBank);
  }

  /**
   * Lấy chi tiết 1 đề.
   */
  static async getExamById(id: string): Promise<ExamBank | null> {
    const cacheKey = `${WEEKLY_EVENT_REDIS_KEYS.EXAM}:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const doc = await ExamBankModel.findById(id).lean();
    if (!doc) return null;

    const exam = this.toExamBank(doc);
    await redis.set(cacheKey, JSON.stringify(exam), 'EX', WEEKLY_EVENT_EXAM_CACHE_TTL);
    return exam;
  }

  /**
   * Tạo đề thi mới.
   */
  static async createExam(input: CreateExamInput): Promise<ExamBank> {
    const questions = input.questions.map((q) => ({
      ...q,
      questionId: crypto.randomUUID(),
    }));

    const doc = await ExamBankModel.create({
      grade: input.grade,
      title: input.title,
      subject: input.subject,
      totalQuestions: questions.length,
      questions,
    });

    return this.toExamBank(doc);
  }

  /**
   * Cập nhật đề thi.
   */
  static async updateExam(id: string, input: UpdateExamInput): Promise<ExamBank | null> {
    const update: Record<string, unknown> = {};
    if (input.grade !== undefined) update.grade = input.grade;
    if (input.title !== undefined) update.title = input.title;
    if (input.subject !== undefined) update.subject = input.subject;
    if (input.questions !== undefined) {
      update.questions = input.questions.map((q) => ({
        ...q,
        questionId: crypto.randomUUID(),
      }));
      update.totalQuestions = input.questions.length;
    }

    const doc = await ExamBankModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) return null;

    await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EXAM}:${id}`);
    return this.toExamBank(doc);
  }

  /**
   * Xóa đề thi. Chặn nếu đang được gán cho event Scheduled/Live.
   */
  static async deleteExam(id: string): Promise<boolean> {
    // Kiểm tra xem đề có đang được gán cho event nào không
    const activeEvent = await WeeklyEventModel.findOne({
      'examAssignments': { $elemMatch: { $eq: id } },
      status: { $in: ['Scheduled', 'Waiting', 'InProgress'] },
    }).lean();

    if (activeEvent) {
      throw new Error(`Không thể xóa đề đang được gán cho sự kiện "${activeEvent.title}" (${activeEvent.status})`);
    }

    const result = await ExamBankModel.findByIdAndDelete(id);
    if (result) {
      await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EXAM}:${id}`);
      return true;
    }
    return false;
  }

  /**
   * Lấy đề thi đã loại bỏ correctKey (dùng để gửi cho client).
   */
  static toPublicExam(exam: ExamBank): Omit<ExamBank, 'questions'> & {
    questions: Array<Omit<typeof exam.questions[0], 'correctKey'>>;
  } {
    return {
      ...exam,
      questions: exam.questions.map(({ correctKey: _correctKey, ...rest }) => rest),
    };
  }

  // ---- Helpers ----

  private static toExamBank(doc: any): ExamBank {
    return {
      _id: String(doc._id),
      grade: doc.grade as number,
      title: doc.title as string,
      subject: doc.subject as string,
      totalQuestions: doc.totalQuestions as number,
      questions: (doc.questions as ExamBank['questions']) || [],
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
