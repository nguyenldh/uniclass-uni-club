// ============================================================
// Weekly Event — Scheduler Service
// Cron jobs: auto-generate event, state transitions (FLOW-001, FLOW-002)
// ============================================================

import { redis } from '../../../config/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_SCHEDULER_LOCK_TTL,
  WEEKLY_EVENT_AUTOGEN_LOCK_TTL,
  WEEKLY_EVENT_NAMESPACES,
  WEEKLY_EVENT_SOCKET_EVENTS,
  WEEKLY_EVENT_ROOM_PREFIX,
  WEEKLY_EVENT_STUDENT_ROOM_PREFIX,
} from '@uniclub/shared';
import { WeeklyEventService } from './weekly-event.service';
import { WeeklyEventStateMachine } from './weekly-event-state-machine.service';
import { WeeklyEventModel, WeeklyEventRoomModel, WeeklyEventParticipationModel, ExamBankModel } from '../../../models/index';
import { WeeklyEventGradingService } from './weekly-event-grading.service';
import { WeeklyEventAnswerService } from './weekly-event-answer.service';
import { WeeklyEventRoomService } from './weekly-event-room.service';
import { ExamBankService } from './exam-bank.service';
import { getIO } from '../../../sockets/index';
import type { WeeklyEventStatus } from '@uniclub/shared';

export class WeeklyEventSchedulerService {
  private static cronInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Khởi động scheduler — chạy mỗi phút để kiểm tra state transitions.
   */
  static startScheduler(): void {
    console.log('[WeeklyEvent] Scheduler started (checking every 60s)');

    // Chạy ngay lần đầu
    this.tick().catch((err) => {
      console.error('[WeeklyEvent] Scheduler tick error:', err);
    });

    // Sau đó mỗi 30 giây
    this.cronInterval = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[WeeklyEvent] Scheduler tick error:', err);
      });
    }, 30000);
  }

  /**
   * Dừng scheduler.
   */
  static stopScheduler(): void {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = null;
      console.log('[WeeklyEvent] Scheduler stopped');
    }
  }

  /**
   * Mỗi tick: kiểm tra auto-generate + state transitions.
   */
  private static async tick(): Promise<void> {
    // 1. Auto-generate event (Chủ nhật 00:00)
    await this.tryAutoGenerate();

    // 2. Kiểm tra state transitions cho các event Scheduled/Waiting/InProgress/Grading/Showing
    await this.checkStateTransitions();
  }

  /**
   * FLOW-001: Auto-generate event nếu là Chủ nhật và chưa có event tuần tới.
   */
  private static async tryAutoGenerate(): Promise<void> {
    const now = new Date();
    // Chỉ chạy vào Chủ nhật, giờ 0-1
    if (now.getDay() !== 0 || now.getHours() > 1) return;

    const lockKey = `${WEEKLY_EVENT_REDIS_KEYS.LOCK_AUTOGEN}`;
    const locked = await redis.set(lockKey, '1', 'EX', WEEKLY_EVENT_AUTOGEN_LOCK_TTL, 'NX');
    if (!locked) return; // Instance khác đang xử lý

    try {
      const event = await WeeklyEventService.autoGenerateWeeklyEvent();
      if (event) {
        console.log(`[WeeklyEvent] Auto-generated event: ${event.title} (${event._id})`);
      }
    } catch (err) {
      console.error('[WeeklyEvent] Auto-generate failed:', err);
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * FLOW-002: Kiểm tra và thực hiện state transitions.
   */
  private static async checkStateTransitions(): Promise<void> {
    const lockKey = `${WEEKLY_EVENT_REDIS_KEYS.LOCK_SCHEDULER}`;
    const locked = await redis.set(lockKey, '1', 'EX', WEEKLY_EVENT_SCHEDULER_LOCK_TTL, 'NX');
    if (!locked) return;

    try {
      const now = new Date();

      // Lấy tất cả event đang ở trạng thái cần theo dõi
      const activeEvents = await WeeklyEventModel.find({
        status: { $in: ['Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing'] },
      }).lean();

      for (const event of activeEvents) {
        const eventId = String(event._id);
        const scheduledStart = new Date(event.scheduledStartAt);
        const waitingEnd = new Date(scheduledStart.getTime() + event.waitingDuration * 60000);
        const examEnd = new Date(waitingEnd.getTime() + event.examDuration * 60000);
        const gradingEnd = new Date(examEnd.getTime() + 2 * 60000); // +2 phút grading
        const showingEnd = new Date(gradingEnd.getTime() + event.leaderboardDuration * 60000);

        for (const grade of event.activeGrades) {
          try {
            await this.transitionGrade(eventId, grade, event, now, scheduledStart, waitingEnd, examEnd, gradingEnd, showingEnd);
          } catch (err) {
            console.error(`[WeeklyEvent] Transition error event=${eventId} grade=${grade}:`, err);
          }
        }
      }
    } finally {
      await redis.del(lockKey);
    }
  }

  private static async transitionGrade(
    eventId: string,
    grade: number,
    event: any,
    now: Date,
    scheduledStart: Date,
    waitingEnd: Date,
    examEnd: Date,
    gradingEnd: Date,
    showingEnd: Date,
  ): Promise<void> {
    const currentState = await WeeklyEventStateMachine.getState(eventId, grade);
    if (!currentState) return;

    // Scheduled → Waiting (đến giờ bắt đầu)
    if (currentState === 'Scheduled' as any && now >= scheduledStart) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Waiting', waitingEnd.toISOString());
      if (!res.success || res.alreadyInState) return;
      
      // Xóa sạch tập hợp online trong Redis đề phòng dữ liệu rác trước đó
      const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
      await redis.del(onlineKey);

      await WeeklyEventModel.findByIdAndUpdate(eventId, { $set: { actualStartAt: now } });
      await this.syncEventStatus(eventId, 'Waiting');
      this.broadcastRoomState(eventId, grade, 'Waiting');
      return;
    }

    // Waiting → InProgress (T+5) — trigger FLOW-005: deliver exam
    if (currentState === 'Waiting' && now >= waitingEnd) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'InProgress', examEnd.toISOString());
      if (!res.success || res.alreadyInState) return;

      // Đồng bộ sĩ số thực tế từ Redis Set sang MongoDB Room một lần duy nhất khi bắt đầu thi
      const joinedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.JOINED(eventId)}:${grade}`;
      const participantCount = await redis.scard(joinedSetKey);
      await WeeklyEventRoomModel.findOneAndUpdate(
        { eventId, grade },
        { $set: { participantCount } }
      );

      await this.syncEventStatus(eventId, 'InProgress');
      this.broadcastRoomState(eventId, grade, 'InProgress');

      // FLOW-005: Phát đề thi cho tất cả học sinh trong room
      await this.deliverExam(eventId, grade, waitingEnd, examEnd);
      return;
    }

    // InProgress → Grading (T+25 hoặc all submitted)
    if (currentState === 'InProgress' && now >= examEnd) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Grading', gradingEnd.toISOString());
      if (!res.success || res.alreadyInState) return;

      await this.syncEventStatus(eventId, 'Grading');
      this.broadcastRoomState(eventId, grade, 'Grading');

      // Tự động nộp bài cho tất cả học sinh chưa nộp thủ công (đánh dấu trong DB)
      await WeeklyEventParticipationModel.updateMany(
        { eventId, grade, submittedAt: null },
        { $set: { submittedAt: examEnd, submissionType: 'auto_timeout' } }
      );

      // Đồng bộ tổng số bài đã nộp (bằng kích cỡ tập hợp đã tham gia) vào MongoDB Room một lần duy nhất
      const joinedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.JOINED(eventId)}:${grade}`;
      const participantCount = await redis.scard(joinedSetKey);
      await WeeklyEventRoomModel.findOneAndUpdate(
        { eventId, grade },
        { $set: { submittedCount: participantCount } }
      );

      // Đẩy tất cả học sinh chưa submit vào queue
      const onlineStudents = await WeeklyEventRoomService.getOnlineStudents(eventId, grade);
      await WeeklyEventAnswerService.enqueueAllUnsubmitted(eventId, grade, onlineStudents, new Set());

      // Bắt đầu grading
      const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
      if (room?.examId) {
        const exam = await ExamBankModel.findById(room.examId).lean();
        if (exam) {
          await WeeklyEventGradingService.gradeAllStudents(
            eventId,
            String(room._id),
            grade,
            exam as any,
          );
        }
      }
      return;
    }

    // Grading → Showing (T+27) — trigger FLOW-009 + FLOW-010
    if (currentState === 'Grading' && now >= gradingEnd) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Showing', showingEnd.toISOString());
      if (!res.success || res.alreadyInState) return;

      await this.syncEventStatus(eventId, 'Showing');
      this.broadcastRoomState(eventId, grade, 'Showing');

      // FLOW-009: Tính leaderboard + FLOW-010: Broadcast
      const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
      if (room) {
        const config = await import('@uniclub/shared').then((m) => m.DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG);
        const topN = await WeeklyEventGradingService.calculateLeaderboard(
          eventId,
          String(room._id),
          grade,
          config.leaderboardLimit,
        );

        const weNs = getIO().of(WEEKLY_EVENT_NAMESPACES.STUDENT);
        const room_ = `${WEEKLY_EVENT_ROOM_PREFIX}:${eventId}:${grade}`;

        // Broadcast leaderboard tới cả room (S06)
        weNs.to(room_).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_LEADERBOARD, {
          topN,
          computedAt: new Date().toISOString(),
        });

        // FLOW-010: Phát tín hiệu Pub/Sub để tất cả các server node cục bộ tự đẩy kết quả
        await redis.publish(
          'we:events:transitions',
          JSON.stringify({ eventId, grade, status: 'Showing' })
        );
      }
      return;
    }

    // Showing → Closed (T+30)
    if (currentState === 'Showing' && now >= showingEnd) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Closed');
      if (!res.success || res.alreadyInState) return;

      await this.syncEventStatus(eventId, 'Closed');
      this.broadcastRoomState(eventId, grade, 'Closed');

      // Cập nhật actualEndAt
      await WeeklyEventModel.findByIdAndUpdate(eventId, { $set: { actualEndAt: now } });

      // Cleanup Redis state
      await WeeklyEventStateMachine.cleanupEventState(eventId, [grade]);
      return;
    }
  }

  /**
   * Đồng bộ WeeklyEvent.status với trạng thái của tất cả rooms.
   * Nếu tất cả rooms đã chuyển sang trạng thái mới → cập nhật event status.
   */
  private static async syncEventStatus(eventId: string, newStatus: WeeklyEventStatus): Promise<void> {
    const event = await WeeklyEventModel.findById(eventId).lean();
    if (!event) return;

    // Chỉ cập nhật nếu tất cả rooms đã chuyển (hoặc vượt qua) trạng thái này
    const rooms = await WeeklyEventRoomModel.find({ eventId }).lean();
    const allTransitioned = rooms.every((r) => {
      const order = ['Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing', 'Closed', 'Cancelled'];
      return order.indexOf(r.status) >= order.indexOf(newStatus);
    });

    if (allTransitioned && event.status !== newStatus) {
      await WeeklyEventModel.findByIdAndUpdate(eventId, { $set: { status: newStatus } });
      console.log(`[WeeklyEvent] Event ${eventId} status synced: ${event.status} → ${newStatus}`);
    }
  }

  /**
   * FLOW-005: Phát đề thi cho tất cả học sinh trong room khi chuyển sang InProgress.
   * Gửi exam:start (SOCK-EVT-S03) per-student vì mỗi student có shuffleSeed riêng.
   */
  private static async deliverExam(
    eventId: string,
    grade: number,
    examStartedAt: Date,
    examEndAt: Date,
  ): Promise<void> {
    try {
      const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
      if (!room?.examId) return;

      const exam = await ExamBankService.getExamById(room.examId);
      if (!exam) return;

      // Loại bỏ correctKey trước khi gửi cho client
      const publicQuestions = ExamBankService.toPublicExam(exam).questions.map((q, idx) => ({
        ...q,
        questionIndex: idx,
        totalQuestions: exam.totalQuestions,
      }));

      const weNs = getIO().of(WEEKLY_EVENT_NAMESPACES.STUDENT);

      // Cập nhật examStartedAt cho tất cả participations
      await WeeklyEventParticipationModel.updateMany(
        { eventId, grade, examStartedAt: null },
        { $set: { examStartedAt: examStartedAt } },
      );

      // Emit exam:start tới cả room (cùng bộ đề — shuffle sẽ do client-side seed sau nếu cần)
      const roomName = `${WEEKLY_EVENT_ROOM_PREFIX}:${eventId}:${grade}`;
      weNs.to(roomName).emit(WEEKLY_EVENT_SOCKET_EVENTS.EXAM_START, {
        questions: publicQuestions,
        examStartedAt: examStartedAt.toISOString(),
        examEndAt: examEndAt.toISOString(),
      });

      console.log(`[WeeklyEvent] Delivered exam to room grade=${grade} (${publicQuestions.length} questions)`);
    } catch (err) {
      console.error(`[WeeklyEvent] deliverExam error grade=${grade}:`, err);
    }
  }

  private static broadcastRoomState(eventId: string, grade: number, status: WeeklyEventStatus): void {
    try {
      const weNs = getIO().of(WEEKLY_EVENT_NAMESPACES.STUDENT);
      const roomName = `${WEEKLY_EVENT_ROOM_PREFIX}:${eventId}:${grade}`;
      weNs.to(roomName).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_STATE, {
        grade,
        status,
        transitionedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[WeeklyEvent] Broadcast error:', err);
    }
  }
}
