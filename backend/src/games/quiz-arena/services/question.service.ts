// ============================================================
// Quiz Arena — Question Service
// ============================================================

import mongoose from 'mongoose';
import { QuestionModel } from '../../../models/index';
import { redis } from '../../../config/index';
import { QUIZ_ARENA_REDIS_KEYS, QUIZ_USER_RECENT_QUESTIONS_LIMIT } from '@uniclub/shared';
import type { QuizQuestion, QuizDifficulty } from '@uniclub/shared';

export class QuestionService {
  /**
   * Chọn ngẫu nhiên `count` câu hỏi cho trận đấu.
   * Ưu tiên đúng grade + bucket, fallback nới lỏng bucket nếu thiếu câu.
   */
  static async pickQuestionsForMatch(
    grade: number,
    abilityBucket: QuizDifficulty,
    count: number,
    excludeIds: string[] = [],
  ): Promise<QuizQuestion[]> {
    // Thử lấy đúng grade + bucket, loại trừ excludeIds
    const excludeObjectIds = excludeIds.map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const strictQuery: Record<string, unknown> = { grade, difficultyBucket: abilityBucket };
    if (excludeObjectIds.length > 0) {
      strictQuery._id = { $nin: excludeObjectIds };
    }

    let docs = await QuestionModel.aggregate([
      { $match: strictQuery },
      { $sample: { size: count } },
    ]);

    // Fallback: nếu thiếu câu → bỏ filter bucket
    if (docs.length < count) {
      const alreadyIds = docs.map((d: any) => d._id);
      const fallbackQuery: Record<string, unknown> = {
        grade,
        _id: { $nin: [...excludeObjectIds, ...alreadyIds] },
      };

      const remaining = count - docs.length;
      const moreDocs = await QuestionModel.aggregate([
        { $match: fallbackQuery },
        { $sample: { size: remaining } },
      ]);
      docs = [...docs, ...moreDocs];
    }

    // Khi pool bị cạn do exclude lịch sử, reset exclude lịch sử để xoay vòng câu hỏi.
    // Vẫn giữ loại trừ các câu đã chọn trong cùng match để tránh duplicate nội bộ.
    if (docs.length < count) {
      const alreadyIds = docs.map((d: any) => d._id);
      const refillQuery: Record<string, unknown> = {
        grade,
        _id: { $nin: alreadyIds },
      };

      const remaining = count - docs.length;
      const refillDocs = await QuestionModel.aggregate([
        { $match: refillQuery },
        { $sample: { size: remaining } },
      ]);
      docs = [...docs, ...refillDocs];
    }

    return docs.map(QuestionService.toQuizQuestion);
  }

  /**
   * Kiểm tra khối lớp có câu hỏi nào không (dùng trước khi ghép trận).
   * Dùng `exists` (limit 1, có index theo grade) nên rất nhẹ — không scan/đếm toàn bộ.
   */
  static async hasQuestionsForGrade(grade: number): Promise<boolean> {
    const doc = await QuestionModel.exists({ grade });
    return doc !== null;
  }

  /**
   * Tăng counter thống kê sau khi user trả lời câu hỏi.
   * Sau đó cập nhật lại `correctRate` và recompute `difficultyBucket` theo threshold.
   */
  static async recordAttempt(
    questionId: string,
    isCorrect: boolean,
    easyThreshold: number,
    hardThreshold: number,
  ): Promise<void> {
    const inc: Record<string, number> = { totalAttempts: 1 };
    if (isCorrect) inc.totalCorrect = 1;

    const doc = await QuestionModel.findByIdAndUpdate(
      questionId,
      { $inc: inc },
      { new: true },
    );

    if (!doc || doc.totalAttempts === 0) return;

    const correctRate = doc.totalCorrect / doc.totalAttempts;
    let difficultyBucket: QuizDifficulty | null = null;

    if (correctRate >= easyThreshold) difficultyBucket = 'easy';
    else if (correctRate <= hardThreshold) difficultyBucket = 'hard';
    else difficultyBucket = 'medium';

    await QuestionModel.findByIdAndUpdate(questionId, {
      $set: { correctRate, difficultyBucket },
    });
  }

  /**
   * Bulk recompute độ khó cho tất cả câu hỏi (admin trigger).
   */
  static async recomputeAllDifficulty(
    easyThreshold: number,
    hardThreshold: number,
  ): Promise<number> {
    const docs = await QuestionModel.find({ totalAttempts: { $gt: 0 } }).lean();
    const bulk = QuestionModel.collection.initializeUnorderedBulkOp();

    for (const doc of docs) {
      const correctRate = doc.totalCorrect / doc.totalAttempts;
      let difficultyBucket: QuizDifficulty | null = null;

      if (correctRate >= easyThreshold) difficultyBucket = 'easy';
      else if (correctRate <= hardThreshold) difficultyBucket = 'hard';
      else difficultyBucket = 'medium';

      bulk.find({ _id: doc._id }).updateOne({
        $set: { correctRate, difficultyBucket },
      });
    }

    if (docs.length === 0) return 0;
    await bulk.execute();
    return docs.length;
  }

  /**
   * Lấy danh sách IDs câu hỏi user đã làm gần đây (từ Redis list).
   */
  static async getRecentQuestionIdsForUser(userId: string): Promise<string[]> {
    const key = `${QUIZ_ARENA_REDIS_KEYS.USER_RECENT_QUESTIONS}:${userId}`;
    return redis.lrange(key, 0, -1);
  }

  /**
   * Ghi nhận các câu hỏi user vừa làm vào Redis (capped list).
   */
  static async recordRecentQuestions(userId: string, questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) return;
    const key = `${QUIZ_ARENA_REDIS_KEYS.USER_RECENT_QUESTIONS}:${userId}`;
    const pipeline = redis.pipeline();
    for (const id of questionIds) {
      pipeline.rpush(key, id);
    }
    pipeline.ltrim(key, -QUIZ_USER_RECENT_QUESTIONS_LIMIT, -1);
    pipeline.expire(key, 60 * 60 * 24 * 30); // 30 ngày
    await pipeline.exec();
  }

  // ============================================================
  // CRUD Methods for CMS
  // ============================================================

  /**
   * Lấy danh sách câu hỏi với filter và phân trang
   */
  static async listQuestions(options: {
    grade?: number;
    difficultyBucket?: QuizDifficulty | 'unknown';
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ questions: QuizQuestion[]; total: number; page: number; pageSize: number }> {
    const { grade, difficultyBucket, search, page = 1, pageSize = 20 } = options;

    const query: Record<string, unknown> = {};
    if (grade) query.grade = grade;
    if (difficultyBucket === 'unknown') {
      query.difficultyBucket = null;
    } else if (difficultyBucket) {
      query.difficultyBucket = difficultyBucket;
    }
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const total = await QuestionModel.countDocuments(query);
    const skip = (page - 1) * pageSize;

    const docs = await QuestionModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    return {
      questions: docs.map(QuestionService.toQuizQuestion),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Lấy câu hỏi theo ID
   */
  static async getById(id: string): Promise<QuizQuestion | null> {
    const doc = await QuestionModel.findById(id).lean();
    return doc ? QuestionService.toQuizQuestion(doc) : null;
  }

  /**
   * Tạo câu hỏi mới
   */
  static async createQuestion(input: {
    grade: number;
    content: string;
    options: [string, string, string, string];
    correctIndex: number;
    timeLimitSeconds: number;
  }): Promise<QuizQuestion> {
    const doc = await QuestionModel.create({
      ...input,
      difficultyBucket: null,
      totalAttempts: 0,
      totalCorrect: 0,
      correctRate: null,
    });
    return QuestionService.toQuizQuestion(doc.toObject());
  }

  /**
   * Cập nhật câu hỏi
   */
  static async updateQuestion(
    id: string,
    input: Partial<{
      grade: number;
      content: string;
      options: [string, string, string, string];
      correctIndex: number;
      timeLimitSeconds: number;
    }>,
  ): Promise<QuizQuestion | null> {
    const doc = await QuestionModel.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    return doc ? QuestionService.toQuizQuestion(doc) : null;
  }

  /**
   * Xóa câu hỏi
   */
  static async deleteQuestion(id: string): Promise<boolean> {
    const result = await QuestionModel.findByIdAndDelete(id);
    return !!result;
  }

  /**
   * Bulk create câu hỏi (cho Excel import)
   */
  static async bulkCreateQuestions(
    inputs: Array<{
      grade: number;
      content: string;
      options: [string, string, string, string];
      correctIndex: number;
      timeLimitSeconds: number;
    }>,
  ): Promise<{ insertedCount: number; errors: Array<{ index: number; error: string }> }> {
    const errors: Array<{ index: number; error: string }> = [];
    const validDocs: any[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      // Validate
      if (!input.grade || input.grade < 1 || input.grade > 12) {
        errors.push({ index: i, error: 'grade phải từ 1-12' });
        continue;
      }
      if (!input.content?.trim()) {
        errors.push({ index: i, error: 'content không được rỗng' });
        continue;
      }
      if (!input.options || input.options.length !== 4) {
        errors.push({ index: i, error: 'options phải có đúng 4 phần tử' });
        continue;
      }
      if (input.correctIndex < 0 || input.correctIndex > 3) {
        errors.push({ index: i, error: 'correctIndex phải từ 0-3' });
        continue;
      }
      if (!input.timeLimitSeconds || input.timeLimitSeconds < 5) {
        errors.push({ index: i, error: 'timeLimitSeconds phải >= 5' });
        continue;
      }

      validDocs.push({
        ...input,
        difficultyBucket: null,
        totalAttempts: 0,
        totalCorrect: 0,
        correctRate: null,
      });
    }

    if (validDocs.length === 0) {
      return { insertedCount: 0, errors };
    }

    try {
      const result = await QuestionModel.insertMany(validDocs, { ordered: false });
      return { insertedCount: result.length, errors };
    } catch (err: any) {
      // Partial insert may have succeeded
      const insertedCount = err.insertedDocs?.length ?? 0;
      if (err.writeErrors) {
        for (const we of err.writeErrors) {
          errors.push({ index: we.index, error: we.errmsg || 'Unknown error' });
        }
      }
      return { insertedCount, errors };
    }
  }

  /**
   * Bulk upsert câu hỏi (có id thì update, không có id thì create)
   */
  static async bulkUpsertQuestions(
    inputs: Array<{
      id?: string;
      grade: number;
      content: string;
      options: [string, string, string, string];
      correctIndex: number;
      timeLimitSeconds: number;
    }>,
  ): Promise<{ createdCount: number; updatedCount: number; errors: Array<{ index: number; error: string }> }> {
    const errors: Array<{ index: number; error: string }> = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // Validate
      if (!input.grade || input.grade < 1 || input.grade > 12) {
        errors.push({ index: i, error: 'grade phải từ 1-12' });
        continue;
      }
      if (!input.content?.trim()) {
        errors.push({ index: i, error: 'content không được rỗng' });
        continue;
      }
      if (!input.options || input.options.length !== 4) {
        errors.push({ index: i, error: 'options phải có đúng 4 phần tử' });
        continue;
      }
      if (input.correctIndex < 0 || input.correctIndex > 3) {
        errors.push({ index: i, error: 'correctIndex phải từ 0-3' });
        continue;
      }
      if (!input.timeLimitSeconds || input.timeLimitSeconds < 5) {
        errors.push({ index: i, error: 'timeLimitSeconds phải >= 5' });
        continue;
      }

      try {
        if (input.id) {
          // Update existing question
          if (mongoose.Types.ObjectId.isValid(input.id)) {
            const updated = await QuestionModel.findByIdAndUpdate(
              input.id,
              {
                $set: {
                  grade: input.grade,
                  content: input.content,
                  options: input.options,
                  correctIndex: input.correctIndex,
                  timeLimitSeconds: input.timeLimitSeconds,
                },
              },
              { new: true },
            );
            if (updated) {
              updatedCount++;
            } else {
              // ID not found → create new instead
              await QuestionModel.create({
                grade: input.grade,
                content: input.content,
                options: input.options,
                correctIndex: input.correctIndex,
                timeLimitSeconds: input.timeLimitSeconds,
                difficultyBucket: null,
                totalAttempts: 0,
                totalCorrect: 0,
                correctRate: null,
              });
              createdCount++;
            }
          } else {
            // Invalid ObjectId → create new
            await QuestionModel.create({
              grade: input.grade,
              content: input.content,
              options: input.options,
              correctIndex: input.correctIndex,
              timeLimitSeconds: input.timeLimitSeconds,
              difficultyBucket: null,
              totalAttempts: 0,
              totalCorrect: 0,
              correctRate: null,
            });
            createdCount++;
          }
        } else {
          // No ID → create new
          await QuestionModel.create({
            grade: input.grade,
            content: input.content,
            options: input.options,
            correctIndex: input.correctIndex,
            timeLimitSeconds: input.timeLimitSeconds,
            difficultyBucket: null,
            totalAttempts: 0,
            totalCorrect: 0,
            correctRate: null,
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({ index: i, error: err.message || 'Unknown error' });
      }
    }

    return { createdCount, updatedCount, errors };
  }

  private static toQuizQuestion(doc: any): QuizQuestion {
    return {
      id: doc._id.toString(),
      grade: doc.grade,
      content: doc.content,
      options: doc.options as [string, string, string, string],
      correctIndex: doc.correctIndex,
      timeLimitSeconds: doc.timeLimitSeconds,
      difficultyBucket: doc.difficultyBucket,
      totalAttempts: doc.totalAttempts ?? 0,
      totalCorrect: doc.totalCorrect ?? 0,
      correctRate: doc.correctRate ?? null,
    };
  }
}
