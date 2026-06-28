// ============================================================
// Boss Battle — QuestionSet Service (DM-05)
// Auto-generate 7 ngày cho mỗi (weekKey × grade) + swap thủ công
// ============================================================

import mongoose from 'mongoose';
import { BossQuestionSetModel, BossInstanceModel } from '../../../models/index';
import { BossQuestionService } from './boss-question.service';
import { BOSS_BATTLE_DAYS_PER_WEEK } from '@uniclub/shared';
import type { BossQuestionSet } from '@uniclub/shared';

function toDto(doc: any): BossQuestionSet {
  return {
    id: String(doc._id),
    weekKey: doc.weekKey,
    gradeLevel: doc.gradeLevel,
    dayIndex: doc.dayIndex,
    questionIds: (doc.questionIds || []).map((id: any) => String(id)),
  };
}

export interface AutoGenerateResult {
  weekKey: string;
  gradeLevel: number;
  /** Số set mới tạo (0 = đã có đủ 7 set sẵn) */
  created: number;
  /** Số set được skip do đã tồn tại */
  skipped: number;
  sets: BossQuestionSet[];
}

export class QuestionSetService {
  static async list(weekKey: string, gradeLevel: number): Promise<BossQuestionSet[]> {
    const docs = await BossQuestionSetModel.find({ weekKey, gradeLevel })
      .sort({ dayIndex: 1 })
      .lean();
    return docs.map(toDto);
  }

  static async getByDay(
    weekKey: string,
    gradeLevel: number,
    dayIndex: number,
  ): Promise<BossQuestionSet | null> {
    const doc = await BossQuestionSetModel.findOne({ weekKey, gradeLevel, dayIndex }).lean();
    return doc ? toDto(doc) : null;
  }

  /**
   * Tự động tạo 7 sets cho (weekKey, gradeLevel).
   * - Lấy `questionsPerDay` từ BossInstance.config (đã snapshot).
   * - Bốc random từ BossQuestion theo grade, không trùng trong cùng tuần
   *   và không trùng với câu đã dùng ở các tuần trước (cùng grade).
   * - Nếu set đã tồn tại: skip (trừ khi `force=true` → regenerate).
   */
  static async autoGenerate(
    weekKey: string,
    gradeLevel: number,
    force = false,
  ): Promise<AutoGenerateResult> {
    const instance = await BossInstanceModel.findOne({ weekKey, gradeLevel });
    if (!instance) {
      throw new Error(`BossInstance not found for weekKey=${weekKey}, grade=${gradeLevel}`);
    }
    const questionsPerDay = instance.config.questionsPerDay;

    const existing = await BossQuestionSetModel.find({ weekKey, gradeLevel })
      .sort({ dayIndex: 1 })
      .lean();
    const existingByDay = new Map<number, any>(existing.map((d: any) => [d.dayIndex, d]));

    const usedIds = new Set<string>();

    // Câu đã dùng ở các tuần TRƯỚC (cùng grade) → luôn loại trừ để chống trùng giữa các tuần.
    // Áp dụng kể cả khi force, vì mục tiêu là không lặp lại câu của tuần cũ.
    const priorSets = await BossQuestionSetModel.find({
      gradeLevel,
      weekKey: { $ne: weekKey },
    })
      .select('questionIds')
      .lean();
    for (const set of priorSets) {
      for (const qid of set.questionIds || []) usedIds.add(String(qid));
    }

    // Câu đã dùng trong tuần hiện tại (để tránh trùng trong cùng tuần) — chỉ tính nếu không force
    if (!force) {
      for (const set of existing) {
        for (const qid of set.questionIds || []) usedIds.add(String(qid));
      }
    }

    let created = 0;
    let skipped = 0;
    const sets: BossQuestionSet[] = [];

    for (let dayIndex = 1; dayIndex <= BOSS_BATTLE_DAYS_PER_WEEK; dayIndex++) {
      const existed = existingByDay.get(dayIndex);

      if (existed && !force) {
        skipped++;
        sets.push(toDto(existed));
        continue;
      }

      const picked = await BossQuestionService.pickRandom(
        gradeLevel,
        questionsPerDay,
        Array.from(usedIds),
      );

      // Nếu kho không đủ câu → cứ lưu phần nào pick được (CMS sẽ thấy thiếu để bổ sung)
      const questionIds = picked.map((q) => new mongoose.Types.ObjectId(q.id));
      picked.forEach((q) => usedIds.add(q.id));

      if (existed && force) {
        const updated = await BossQuestionSetModel.findByIdAndUpdate(
          existed._id,
          { $set: { questionIds } },
          { new: true },
        ).lean();
        if (updated) {
          created++;
          sets.push(toDto(updated));
        }
      } else {
        const doc = await BossQuestionSetModel.create({
          weekKey,
          gradeLevel,
          dayIndex,
          questionIds,
        });
        created++;
        sets.push(toDto(doc.toObject()));
      }
    }

    return { weekKey, gradeLevel, created, skipped, sets };
  }

  /**
   * Đổi 1 câu trong set bằng câu khác.
   */
  static async swapQuestion(
    setId: string,
    oldQuestionId: string,
    newQuestionId: string,
  ): Promise<BossQuestionSet | null> {
    if (!mongoose.Types.ObjectId.isValid(setId)) return null;
    if (!mongoose.Types.ObjectId.isValid(newQuestionId)) {
      throw new Error('Invalid newQuestionId');
    }

    const set = await BossQuestionSetModel.findById(setId);
    if (!set) return null;

    const idx = set.questionIds.findIndex((id) => String(id) === oldQuestionId);
    if (idx < 0) throw new Error('oldQuestionId not in set');

    // Validate newQuestion tồn tại và cùng grade
    const newQ = await BossQuestionService.getById(newQuestionId);
    if (!newQ) throw new Error('newQuestionId not found');
    if (newQ.grade !== set.gradeLevel) {
      throw new Error(`Question grade mismatch (set=${set.gradeLevel}, question=${newQ.grade})`);
    }

    // Tránh tạo trùng câu trong cùng set
    if (set.questionIds.some((id, i) => i !== idx && String(id) === newQuestionId)) {
      throw new Error('newQuestionId already in set');
    }

    set.questionIds[idx] = new mongoose.Types.ObjectId(newQuestionId);
    await set.save();

    return toDto(set.toObject());
  }
}
