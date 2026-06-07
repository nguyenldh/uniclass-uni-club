// ============================================================
// Weekly Event — Scheduler Service
// Cron jobs: auto-generate event, state transitions (FLOW-001, FLOW-002)
// ============================================================

import { redis } from '../../../config/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_SCHEDULER_LOCK_TTL,
  WEEKLY_EVENT_AUTOGEN_LOCK_TTL,
} from '@uniclub/shared';
import { WeeklyEventService } from './weekly-event.service';
import { WeeklyEventStateMachine } from './weekly-event-state-machine.service';
import { WeeklyEventModel, WeeklyEventRoomModel, ExamBankModel } from '../../../models/index';
import { WeeklyEventGradingService } from './weekly-event-grading.service';
import { WeeklyEventAnswerService } from './weekly-event-answer.service';
import { WeeklyEventRoomService } from './weekly-event-room.service';
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

    // Sau đó mỗi 60 giây
    this.cronInterval = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[WeeklyEvent] Scheduler tick error:', err);
      });
    }, 5000);
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
      await WeeklyEventStateMachine.transition(eventId, grade, 'Waiting');
      await WeeklyEventModel.findByIdAndUpdate(eventId, { $set: { actualStartAt: now } });
      await this.syncEventStatus(eventId, 'Waiting');
      this.broadcastRoomState(eventId, grade, 'Waiting');
      return;
    }

    // Waiting → InProgress (T+5)
    if (currentState === 'Waiting' && now >= waitingEnd) {
      await WeeklyEventStateMachine.transition(eventId, grade, 'InProgress');
      await this.syncEventStatus(eventId, 'InProgress');
      this.broadcastRoomState(eventId, grade, 'InProgress');
      return;
    }

    // InProgress → Grading (T+25 hoặc all submitted)
    if (currentState === 'InProgress' && now >= examEnd) {
      await WeeklyEventStateMachine.transition(eventId, grade, 'Grading');
      await this.syncEventStatus(eventId, 'Grading');
      this.broadcastRoomState(eventId, grade, 'Grading');

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

    // Grading → Showing (T+27)
    if (currentState === 'Grading' && now >= gradingEnd) {
      await WeeklyEventStateMachine.transition(eventId, grade, 'Showing');
      await this.syncEventStatus(eventId, 'Showing');
      this.broadcastRoomState(eventId, grade, 'Showing');

      // Tính leaderboard
      const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
      if (room) {
        const config = await import('@uniclub/shared').then((m) => m.DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG);
        const topN = await WeeklyEventGradingService.calculateLeaderboard(
          eventId,
          String(room._id),
          grade,
          config.leaderboardLimit,
        );

        // Broadcast leaderboard
        const io = getIO();
        io.to(`${eventId}:${grade}`).emit('room:leaderboard', {
          topN,
          computedAt: new Date().toISOString(),
        });
      }
      return;
    }

    // Showing → Closed (T+30)
    if (currentState === 'Showing' && now >= showingEnd) {
      await WeeklyEventStateMachine.transition(eventId, grade, 'Closed');
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

  private static broadcastRoomState(eventId: string, grade: number, status: WeeklyEventStatus): void {
    try {
      const io = getIO();
      io.to(`${eventId}:${grade}`).emit('room:state', {
        grade,
        status,
        transitionedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[WeeklyEvent] Broadcast error:', err);
    }
  }
}
