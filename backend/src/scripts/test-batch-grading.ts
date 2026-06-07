import mongoose from 'mongoose';
import { connectDB, connectRedis, redis } from '../config';
import {
  WeeklyEventModel,
  WeeklyEventRoomModel,
  WeeklyEventParticipationModel,
  WeeklyEventResultModel,
  ExamBankModel,
} from '../models';
import { WeeklyEventGradingService } from '../games/weekly-event/services/weekly-event-grading.service';
import { WEEKLY_EVENT_REDIS_KEYS } from '@uniclub/shared';

async function runSimulation() {
  console.log('[Sim] Connecting to DB & Redis...');
  await connectDB();
  await connectRedis();

  // 1. Lấy hoặc tạo event test
  let event = await WeeklyEventModel.findOne({ title: /Test/i });
  if (!event) {
    console.log('[Sim] No test event found. Please run seed script first or create one.');
    // Tạo nhanh 1 event mẫu để test
    const exam = await ExamBankModel.findOne({ grade: 10 });
    if (!exam) {
      console.error('[Sim] No exam bank found. Seed database first.');
      process.exit(1);
    }
    event = await WeeklyEventModel.create({
      weekNumber: 52,
      year: 2026,
      title: 'Simulation Test Event',
      scheduledStartAt: new Date(),
      waitingDuration: 5,
      examDuration: 20,
      leaderboardDuration: 5,
      questionCountOverride: 25,
      activeGrades: [10],
      status: 'InProgress',
      examAssignments: { '10': String(exam._id) },
      createdBy: 'sim-script',
    });

    await WeeklyEventRoomModel.create({
      eventId: event._id,
      grade: 10,
      examId: String(exam._id),
      status: 'InProgress',
      stateTransitions: [],
      participantCount: 0,
      submittedCount: 0,
    });
  }

  const eventId = String(event._id);
  const grade = 10;
  const room = await WeeklyEventRoomModel.findOne({ eventId, grade });
  if (!room || !room.examId) {
    console.error('[Sim] Room not found or has no examId');
    process.exit(1);
  }

  const exam = await ExamBankModel.findById(room.examId).lean();
  if (!exam) {
    console.error('[Sim] Exam not found');
    process.exit(1);
  }

  console.log(`[Sim] Using event: ${event.title} (${eventId})`);
  console.log(`[Sim] Using exam: ${exam.title} (${exam._id}) with ${exam.questions.length} questions`);

  // 2. Dọn dẹp dữ liệu cũ (nếu có)
  console.log('[Sim] Cleaning old simulation data...');
  await WeeklyEventParticipationModel.deleteMany({ eventId, grade, studentId: { $regex: /^sim_/ } });
  await WeeklyEventResultModel.deleteMany({ eventId, roomId: room._id, studentId: { $regex: /^sim_/ } });
  const lbKey = `${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${grade}`;
  await redis.del(lbKey);

  // 3. Tạo 1,000 học sinh giả lập
  const studentCount = 10000;
  console.log(`[Sim] Generating ${studentCount} mock students, participations and Redis answers...`);

  const participationsData = [];
  const answerPipeline = redis.pipeline();

  for (let i = 1; i <= studentCount; i++) {
    const studentId = `sim_student_${String(i).padStart(4, '0')}`;
    participationsData.push({
      eventId: new mongoose.Types.ObjectId(eventId),
      roomId: room._id,
      studentId,
      grade,
      joinedAt: new Date(Date.now() - 25 * 60000), // joined 25m ago
      examStartedAt: new Date(Date.now() - 20 * 60000), // started 20m ago
      shuffleSeed: `seed_${i}`,
      disconnectCount: i % 10 === 0 ? 1 : 0, // sim some disconnects
    });

    // Tạo đáp án giả lập
    const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${studentId}`;

    // Mỗi học sinh trả lời ngẫu nhiên từ 15-25 câu hỏi
    const answersToSubmitCount = 15 + (i % 11);
    for (let qIdx = 0; qIdx < answersToSubmitCount; qIdx++) {
      const q = exam.questions[qIdx];
      // sim correct rate: sim_student_0001 trả lời đúng nhiều hơn
      const isCorrect = i % 2 === 0 || qIdx % 3 !== 0;
      const selectedKey = isCorrect ? q.correctKey : (q.correctKey === 'A' ? 'B' : 'A');

      const answerTime = Date.now() - (20 - qIdx) * 30000; // time spacing
      answerPipeline.hset(answersKey, q.questionId, JSON.stringify({
        key: selectedKey,
        at: answerTime,
      }));
    }

    // Set disconnect count tạm thời trên Redis
    if (i % 10 === 0) {
      answerPipeline.set(`we:disconnect_count:${eventId}:${studentId}`, '3');
    }
  }

  await WeeklyEventParticipationModel.insertMany(participationsData);
  await answerPipeline.exec();
  console.log('[Sim] Mock data inserted.');

  // 4. Đo đạc hiệu năng của Batch Grading
  console.log('[Sim] Starting Batch Grading...');
  const startGradingTime = Date.now();

  const gradedCount = await WeeklyEventGradingService.gradeAllStudents(
    eventId,
    String(room._id),
    grade,
    exam as any
  );

  const gradingDuration = Date.now() - startGradingTime;
  console.log(`[Sim] Batch Grading finished!`);
  console.log(`[Sim] Graded ${gradedCount}/${studentCount} students.`);
  console.log(`[Sim] Execution Time: ${gradingDuration} ms (${(gradingDuration / 1000).toFixed(2)} seconds)`);

  // 5. Kiểm tra tính chính xác của bảng xếp hạng (Leaderboard) và Cache
  console.log('[Sim] Verifying leaderboard and cache...');
  const lbSize = await redis.zcard(lbKey);
  console.log(`[Sim] Leaderboard Redis ZSET size: ${lbSize} (Expected: ${gradedCount})`);

  // Thử lấy kết quả cá nhân của học sinh ngẫu nhiên
  const testStudentId = 'sim_student_0500';
  const startPersonalTime = Date.now();
  const personalResult = await WeeklyEventGradingService.getPersonalResult(eventId, testStudentId, grade);
  const personalDuration = Date.now() - startPersonalTime;

  if (personalResult) {
    console.log(`[Sim] Personal Result for ${testStudentId}:`);
    console.log(`  - Correct count: ${personalResult.correctCount}`);
    console.log(`  - Score: ${personalResult.score}`);
    console.log(`  - Rank in ZSET: ${personalResult.rank}`);
    console.log(`  - Total Time taken: ${personalResult.totalTimeMs} ms`);
    console.log(`  - Query Duration (Cache hit): ${personalDuration} ms`);
  } else {
    console.error(`[Sim] Failed to retrieve personal result for ${testStudentId}`);
  }

  // 6. Dọn dẹp dữ liệu giả lập sau khi kết thúc để tránh rác DB
  console.log('[Sim] Cleaning simulation data...');
  await WeeklyEventParticipationModel.deleteMany({ eventId, grade, studentId: { $regex: /^sim_/ } });
  await WeeklyEventResultModel.deleteMany({ eventId, roomId: room._id, studentId: { $regex: /^sim_/ } });
  await redis.del(lbKey);

  // Dọn dẹp cache personal result
  const cleanupPipeline = redis.pipeline();
  for (let i = 1; i <= studentCount; i++) {
    const studentId = `sim_student_${String(i).padStart(4, '0')}`;
    cleanupPipeline.del(`we:personal_result:${eventId}:${studentId}`);
  }
  await cleanupPipeline.exec();

  console.log('[Sim] Verification finished successfully!');
  await mongoose.disconnect();
  await redis.quit();
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error('[Sim] Simulation error:', err);
  process.exit(1);
});
