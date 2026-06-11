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
  WEEKLY_EVENT_MAX_GRADING_MINUTES,
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
   * Timer chính xác cho từng room — bắn transition đúng deadline thay vì đợi cron tick.
   * Key: `${eventId}:${grade}:${deadlineISO}` (kèm deadline để event đổi giờ thì timer cũ tự no-op).
   * MỌI instance đều arm — nhiều timer cùng bắn vẫn an toàn nhờ transition lock + idempotency.
   */
  private static transitionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Không arm timer cho deadline xa hơn cửa sổ này — tick sau sẽ arm (tránh giữ timer dài vô ích) */
  private static readonly ARM_MAX_DELAY_MS = 2 * 60 * 60 * 1000;

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
    for (const timer of this.transitionTimers.values()) {
      clearTimeout(timer);
    }
    this.transitionTimers.clear();
  }

  /**
   * Mỗi tick: kiểm tra auto-generate + state transitions.
   */
  private static async tick(): Promise<void> {
    // 1. Auto-generate event (Chủ nhật 00:00)
    await this.tryAutoGenerate();

    // 2. Arm timer chính xác cho các deadline sắp tới — chạy trên MỌI instance (không lock)
    //    để instance nào cũng bắn được transition đúng giờ, instance chết có instance khác đỡ
    await this.armUpcomingTransitions();

    // 3. Kiểm tra state transitions cho các event Scheduled/Waiting/InProgress/Grading/Showing
    //    (lưới an toàn — bắt các deadline đã quá hạn mà timer không bắn được)
    await this.checkStateTransitions();
  }

  /**
   * Tính các mốc thời gian tĩnh của event.
   */
  private static computeTimeline(event: any): {
    scheduledStart: Date;
    waitingEnd: Date;
    examEnd: Date;
    maxGradingEnd: Date;
    fallbackShowingEnd: Date;
  } {
    const scheduledStart = new Date(event.scheduledStartAt);
    const waitingEnd = new Date(scheduledStart.getTime() + event.waitingDuration * 60000);
    const examEnd = new Date(waitingEnd.getTime() + event.examDuration * 60000);
    // Grading → Showing chuyển ngay khi chấm xong; deadline này chỉ là fallback
    // nếu instance chấm bài bị crash giữa chừng
    const maxGradingEnd = new Date(examEnd.getTime() + WEEKLY_EVENT_MAX_GRADING_MINUTES * 60000);
    const fallbackShowingEnd = new Date(maxGradingEnd.getTime() + event.leaderboardDuration * 60000);
    return { scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd };
  }

  /**
   * Arm timer bắn transition đúng deadline cho 1 room.
   * Idempotent theo (eventId, grade, deadline) — gọi nhiều lần không stack timer.
   * An toàn multi-instance: callback là mini-tick tự vệ, transition lock sẽ arbitrate.
   */
  static armTransitionTimer(eventId: string, grade: number, at: Date): void {
    const delay = at.getTime() - Date.now();
    // Quá hạn → cron tick xử lý ngay trong lượt quét; quá xa → tick sau sẽ arm
    if (delay <= 0 || delay > this.ARM_MAX_DELAY_MS) return;

    const key = `${eventId}:${grade}:${at.toISOString()}`;
    if (this.transitionTimers.has(key)) return;

    const timer = setTimeout(() => {
      this.transitionTimers.delete(key);
      this.miniTick(eventId, grade).catch((err) => {
        console.error(`[WeeklyEvent] Timer transition error event=${eventId} grade=${grade}:`, err);
      });
    }, delay);
    this.transitionTimers.set(key, timer);
  }

  /**
   * Mini-tick cho đúng 1 room khi timer chính xác bắn.
   * Tự vệ: re-fetch event + state mới nhất, KHÔNG tin dữ liệu lúc arm —
   * event có thể đã bị đổi giờ/hủy, hoặc instance khác đã chuyển trạng thái rồi.
   */
  private static async miniTick(eventId: string, grade: number): Promise<void> {
    const event = await WeeklyEventModel.findById(eventId).lean();
    if (!event) return;
    if (!['Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing'].includes(event.status)) return;

    const now = new Date();
    const { scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd } = this.computeTimeline(event);
    await this.transitionGrade(eventId, grade, event, now, scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd);
  }

  /**
   * Quét các room đang hoạt động và arm timer cho deadline kế tiếp nếu nó rơi
   * trong cửa sổ ARM_MAX_DELAY_MS. Chạy trên mọi instance, chỉ đọc — không cần lock.
   */
  private static async armUpcomingTransitions(): Promise<void> {
    try {
      const activeEvents = await WeeklyEventModel.find({
        status: { $in: ['Scheduled', 'Waiting', 'InProgress', 'Grading', 'Showing'] },
      }).lean();

      for (const event of activeEvents) {
        const eventId = String(event._id);
        const { scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd } = this.computeTimeline(event);

        for (const grade of event.activeGrades) {
          const stateData = await WeeklyEventStateMachine.getStateData(eventId, grade);
          if (!stateData) continue;

          let deadline: Date | null = null;
          switch (stateData.status) {
            case 'Scheduled':
              deadline = scheduledStart;
              break;
            case 'Waiting':
              deadline = waitingEnd;
              break;
            case 'InProgress':
              deadline = examEnd;
              break;
            case 'Grading':
              // Bình thường Grading → Showing chuyển ngay khi chấm xong;
              // timer này chỉ là fallback nếu instance chấm bài crash
              deadline = maxGradingEnd;
              break;
            case 'Showing':
              deadline = stateData.nextTransitionAt ? new Date(stateData.nextTransitionAt) : fallbackShowingEnd;
              break;
            default:
              break; // Closed/Cancelled — không còn deadline
          }

          if (deadline) {
            this.armTransitionTimer(eventId, grade, deadline);
          }
        }
      }
    } catch (err) {
      console.error('[WeeklyEvent] armUpcomingTransitions error:', err);
    }
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
        const { scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd } = this.computeTimeline(event);

        for (const grade of event.activeGrades) {
          try {
            await this.transitionGrade(eventId, grade, event, now, scheduledStart, waitingEnd, examEnd, maxGradingEnd, fallbackShowingEnd);
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
    maxGradingEnd: Date,
    fallbackShowingEnd: Date,
  ): Promise<void> {
    let stateData = await WeeklyEventStateMachine.getStateData(eventId, grade);
    
    if (!stateData) {
      // Self-heal: key roomstate có thể đã mất (event bị dời lịch khiến TTL cũ hết hạn,
      // Redis flush...). Event vẫn active trong Mongo → dựng lại state Scheduled để
      // scheduler tiếp tục vận hành thay vì bỏ qua room này vĩnh viễn.
      if (event.status !== 'Scheduled') return; // các trạng thái sau cần dữ liệu room thật — không tự dựng lại
      console.warn(`[WeeklyEvent] Room state missing event=${eventId} grade=${grade} — re-init từ Mongo (Scheduled)`);
      await WeeklyEventStateMachine.initRoomState(eventId, grade, scheduledStart.toISOString(), event);
      stateData = { status: 'Scheduled' as any };
    }

    const currentState = stateData.status;

    // Scheduled → Waiting (đến giờ bắt đầu)
    if (currentState === 'Scheduled' as any && now >= scheduledStart) {
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Waiting', waitingEnd.toISOString());
      if (!res.success || res.alreadyInState) return;

      // Arm timer cho transition kế tiếp ngay khi vào state mới
      this.armTransitionTimer(eventId, grade, waitingEnd);

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

      // Arm timer cho transition kế tiếp ngay khi vào state mới
      this.armTransitionTimer(eventId, grade, examEnd);

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
      const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Grading', maxGradingEnd.toISOString());
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

      // Chấm xong → chuyển Showing ngay, không đợi cron tick kế tiếp.
      // (Nếu gradeAllStudents throw thì không tới đây — fallback bên dưới sẽ xử lý.)
      await this.enterShowing(eventId, grade, event);
      return;
    }

    // Grading → Showing: FALLBACK — bình thường đã chuyển ngay sau khi chấm xong ở trên.
    // Chỉ kích hoạt nếu instance chấm bài crash/lỗi giữa chừng khiến room kẹt ở Grading.
    if (currentState === 'Grading' && now >= maxGradingEnd) {
      console.warn(`[WeeklyEvent] Room event=${eventId} grade=${grade} kẹt ở Grading quá ${WEEKLY_EVENT_MAX_GRADING_MINUTES} phút — force chuyển Showing`);
      await this.enterShowing(eventId, grade, event);
      return;
    }

    // Showing → Closed — deadline thực tế lưu trong nextTransitionAt khi vào Showing
    // (Showing có thể bắt đầu sớm hơn timeline tĩnh vì chấm bài xong trước hạn)
    if (currentState === 'Showing') {
      const showingEnd = stateData.nextTransitionAt
        ? new Date(stateData.nextTransitionAt)
        : fallbackShowingEnd;
      if (now < showingEnd) return;

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
   * Grading → Showing: chuyển ngay khi chấm bài xong (FLOW-009 + FLOW-010).
   * Showing kéo dài leaderboardDuration phút TÍNH TỪ LÚC VÀO Showing —
   * deadline được lưu vào nextTransitionAt để cron đóng room đúng giờ.
   */
  private static async enterShowing(eventId: string, grade: number, event: any): Promise<void> {
    const showingEnd = new Date(Date.now() + event.leaderboardDuration * 60000);
    const res = await WeeklyEventStateMachine.transition(eventId, grade, 'Showing', showingEnd.toISOString());
    if (!res.success || res.alreadyInState) return;

    // Arm timer đóng room đúng giờ (Showing → Closed)
    this.armTransitionTimer(eventId, grade, showingEnd);

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
