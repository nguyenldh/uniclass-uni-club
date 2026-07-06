// ============================================================
// Boss Battle — Question Service (CRUD kho câu hỏi)
// ============================================================

import mongoose from 'mongoose';
import { BossQuestionModel, BossQuestionSetModel } from '../../../models/index';
import type {
  BossQuestion,
  CreateBossQuestionInput,
  UpdateBossQuestionInput,
  BulkUpsertBossQuestionInput,
} from '@uniclub/shared';

export type { CreateBossQuestionInput, UpdateBossQuestionInput };

export interface ListBossQuestionsParams {
  grade?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListBossQuestionsResult {
  items: BossQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

function validateInput(input: Partial<CreateBossQuestionInput>): string | null {
  if (!input || typeof input !== 'object') return 'invalid input';
  if (
    input.grade === undefined ||
    !Number.isFinite(input.grade) ||
    (input.grade as number) < 1 ||
    (input.grade as number) > 12
  ) {
    return 'grade must be 1..12';
  }
  if (!input.content || !String(input.content).trim()) return 'content required';
  if (!Array.isArray(input.options) || input.options.length !== 4) {
    return 'options must have 4 items';
  }
  if (input.options.some((o) => !String(o ?? '').trim())) return 'all 4 options required';
  if (
    input.correctIndex === undefined ||
    !Number.isInteger(input.correctIndex) ||
    input.correctIndex < 0 ||
    input.correctIndex > 3
  ) {
    return 'correctIndex must be 0..3';
  }
  return null;
}

function toDto(doc: any): BossQuestion {
  return {
    id: String(doc._id),
    grade: doc.grade,
    content: doc.content,
    imageUrl: doc.imageUrl,
    options: doc.options as [string, string, string, string],
    correctIndex: doc.correctIndex,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class BossQuestionService {
  static async list(params: ListBossQuestionsParams): Promise<ListBossQuestionsResult> {
    const { grade, isActive, search, page = 1, pageSize = 20 } = params;
    const filter: Record<string, unknown> = {};
    if (grade !== undefined) filter.grade = grade;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search?.trim()) filter.content = { $regex: search.trim(), $options: 'i' };

    const skip = (Math.max(page, 1) - 1) * pageSize;
    const [docs, total] = await Promise.all([
      BossQuestionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      BossQuestionModel.countDocuments(filter),
    ]);

    return {
      items: docs.map(toDto),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Liệt kê câu hỏi "chưa được gán" theo khối — phục vụ danh sách Thay thế:
   *  (1) đúng khối (grade), (2) đang active, (3) KHÔNG nằm trong bất kỳ BossQuestionSet nào.
   * Câu vừa bị Xóa khỏi set sẽ không còn trong set nào → tự động xuất hiện ở đây.
   */
  static async listUnassignedByGrade(
    grade: number,
    search?: string,
    limit = 50,
  ): Promise<BossQuestion[]> {
    const assignedIds = await BossQuestionSetModel.distinct('questionIds');
    const filter: Record<string, unknown> = {
      grade,
      isActive: true,
      _id: { $nin: assignedIds },
    };
    if (search?.trim()) filter.content = { $regex: search.trim(), $options: 'i' };
    const docs = await BossQuestionModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(toDto);
  }

  static async getById(id: string): Promise<BossQuestion | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await BossQuestionModel.findById(id).lean();
    return doc ? toDto(doc) : null;
  }

  static async getByIds(ids: string[]): Promise<BossQuestion[]> {
    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length === 0) return [];
    const docs = await BossQuestionModel.find({ _id: { $in: objectIds } }).lean();
    // Preserve input order
    const map = new Map(docs.map((d: any) => [String(d._id), toDto(d)]));
    return ids.map((id) => map.get(id)).filter((q): q is BossQuestion => Boolean(q));
  }

  static async create(input: CreateBossQuestionInput): Promise<BossQuestion> {
    const doc = await BossQuestionModel.create({
      grade: input.grade,
      content: input.content,
      imageUrl: input.imageUrl,
      options: input.options,
      correctIndex: input.correctIndex,
      isActive: input.isActive ?? true,
    });
    return toDto(doc.toObject());
  }

  static async update(id: string, input: UpdateBossQuestionInput): Promise<BossQuestion | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await BossQuestionModel.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    return doc ? toDto(doc) : null;
  }

  static async remove(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await BossQuestionModel.findByIdAndDelete(id);
    return Boolean(result);
  }

  static async bulkCreate(
    inputs: CreateBossQuestionInput[],
  ): Promise<{ insertedCount: number; errors: Array<{ index: number; error: string }> }> {
    if (inputs.length === 0) return { insertedCount: 0, errors: [] };
    const errors: Array<{ index: number; error: string }> = [];
    let insertedCount = 0;
    for (let i = 0; i < inputs.length; i++) {
      try {
        const validation = validateInput(inputs[i]);
        if (validation) {
          errors.push({ index: i, error: validation });
          continue;
        }
        await BossQuestionService.create(inputs[i]);
        insertedCount++;
      } catch (err: any) {
        errors.push({ index: i, error: err?.message || 'Unknown error' });
      }
    }
    return { insertedCount, errors };
  }

  /**
   * Bulk upsert: có id hợp lệ + tồn tại → update; ngược lại → create.
   */
  static async bulkUpsert(
    inputs: BulkUpsertBossQuestionInput[],
  ): Promise<{
    createdCount: number;
    updatedCount: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < inputs.length; i++) {
      const { id, ...rest } = inputs[i];
      try {
        const validation = validateInput(rest);
        if (validation) {
          errors.push({ index: i, error: validation });
          continue;
        }
        if (id && mongoose.Types.ObjectId.isValid(id)) {
          const updated = await BossQuestionService.update(id, rest);
          if (updated) {
            updatedCount++;
            continue;
          }
        }
        await BossQuestionService.create(rest);
        createdCount++;
      } catch (err: any) {
        errors.push({ index: i, error: err?.message || 'Unknown error' });
      }
    }

    return { createdCount, updatedCount, errors };
  }

  /**
   * Pick `count` câu ngẫu nhiên theo grade, loại trừ `excludeIds`.
   * Chỉ lấy câu `isActive=true`.
   */
  static async pickRandom(
    grade: number,
    count: number,
    excludeIds: string[] = [],
  ): Promise<BossQuestion[]> {
    const excludeObjectIds = excludeIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const match: Record<string, unknown> = { grade, isActive: true };
    if (excludeObjectIds.length > 0) {
      match._id = { $nin: excludeObjectIds };
    }

    const docs = await BossQuestionModel.aggregate([
      { $match: match },
      { $sample: { size: count } },
    ]);

    return docs.map(toDto);
  }

  /** Đếm câu active CHƯA được gán set nào theo grade (dùng để check đủ câu khởi tạo tuần) */
  static async countActiveByGrade(grade: number): Promise<number> {
    const assignedIds = await BossQuestionSetModel.distinct('questionIds');
    return BossQuestionModel.countDocuments({
      grade,
      isActive: true,
      _id: { $nin: assignedIds },
    });
  }

  /** Đếm câu active CHƯA được gán gom nhóm theo grade → { [grade]: count } */
  static async countActiveGroupedByGrade(): Promise<Record<number, number>> {
    const assignedIds = await BossQuestionSetModel.distinct('questionIds');
    const rows = await BossQuestionModel.aggregate<{ _id: number; count: number }>([
      { $match: { isActive: true, _id: { $nin: assignedIds } } },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
    ]);
    const out: Record<number, number> = {};
    for (const r of rows) out[r._id] = r.count;
    return out;
  }
}
