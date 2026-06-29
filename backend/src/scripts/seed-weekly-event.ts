// ============================================================
// Weekly Event — Seed Script
// Tạo general config mặc định + exam mẫu + event test
// Chạy: npx tsx src/scripts/seed-weekly-event.ts
// ============================================================

import mongoose from 'mongoose';
import { connectDB, connectRedis, redis } from '../config';
import {
  WeeklyEventGeneralConfigModel,
  WeeklyEventModel,
  WeeklyEventRoomModel,
  ExamBankModel,
} from '../models';
import { DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG } from '@uniclub/shared';

async function seed() {
  console.log('[Seed] Connecting to DB...');
  await connectDB();
  await connectRedis();

  // 1. Seed general config
  console.log('[Seed] Creating general config...');
  await WeeklyEventGeneralConfigModel.findOneAndUpdate(
    { _id: 'singleton' },
    { $set: { ...DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG } },
    { upsert: true, new: true },
  );
  console.log('[Seed] General config created.');

  // 2. Seed sample exams for grades 1-12
  console.log('[Seed] Creating sample exams...');
  const sampleQuestions = Array.from({ length: 25 }, (_, i) => ({
    questionId: `q_${String(i + 1).padStart(3, '0')}`,
    stem: `Câu hỏi mẫu số ${i + 1}: Đây là nội dung câu hỏi kiểm tra kiến thức.`,
    options: [
      { key: 'A', text: `Đáp án A cho câu ${i + 1}` },
      { key: 'B', text: `Đáp án B cho câu ${i + 1}` },
      { key: 'C', text: `Đáp án C cho câu ${i + 1}` },
      { key: 'D', text: `Đáp án D cho câu ${i + 1}` },
    ],
    correctKey: (['A', 'B', 'C', 'D'] as const)[i % 4],
    shuffleable: true,
  }));

  const examIds: Record<number, string> = {};
  for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const existing = await ExamBankModel.findOne({ grade, title: `Đề mẫu khối ${grade}` });
    if (existing) {
      examIds[grade] = String(existing._id);
      console.log(`[Seed] Exam for grade ${grade} already exists, skipping.`);
      continue;
    }

    const doc = await ExamBankModel.create({
      grade,
      title: `Đề mẫu khối ${grade}`,
      totalQuestions: 25,
      questions: sampleQuestions,
    });
    examIds[grade] = String(doc._id);
    console.log(`[Seed] Created exam for grade ${grade}: ${doc._id}`);
  }

  // 3. Seed a test event for current week
  console.log('[Seed] Creating test event...');
  const now = new Date();
  const nextSaturday = getNextSaturday(now);
  const weekNumber = getISOWeekNumber(nextSaturday);
  const year = nextSaturday.getFullYear();

  const existingEvent = await WeeklyEventModel.findOne({ weekNumber, year });
  if (existingEvent) {
    console.log(`[Seed] Event for week ${weekNumber}/${year} already exists, skipping.`);
  } else {
    const event = await WeeklyEventModel.create({
      weekNumber,
      year,
      title: `Đấu Trường Số ${weekNumber}: Thử Thách Tuần (Test)`,
      scheduledStartAt: nextSaturday,
      waitingDuration: 5,
      examDuration: 20,
      leaderboardDuration: 5,
      questionCountOverride: 25,
      activeGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      status: 'Draft',
      examAssignments: Object.fromEntries(
        Object.entries(examIds).map(([grade, examId]) => [grade, examId]),
      ),
      createdBy: 'seed-script',
    });

    // Create rooms
    await WeeklyEventRoomModel.insertMany(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => ({
        eventId: event._id,
        grade,
        examId: examIds[grade],
        status: 'Waiting',
        stateTransitions: [],
        participantCount: 0,
        submittedCount: 0,
      })),
    );

    console.log(`[Seed] Created event: ${event.title} (${event._id})`);
  }

  console.log('[Seed] Done!');
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
}

function getNextSaturday(from: Date): Date {
  const result = new Date(from);
  const day = result.getDay();
  const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilSaturday);
  result.setHours(10, 0, 0, 0);
  return result;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
