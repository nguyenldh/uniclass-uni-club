// ============================================================
// Weekly Event — Event Service
// Quản lý CRUD event, publish, cancel, auto-generate (FLOW-001)
// ============================================================

import { redis } from '../../../config/index';
import {
  WeeklyEventModel,
  WeeklyEventRoomModel,
} from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_EVENT_CACHE_TTL,
  WEEKLY_EVENT_DEFAULT_QUESTION_COUNT,
} from '@uniclub/shared';
import type {
  WeeklyEvent,
  WeeklyEventStatus,
  CreateEventInput,
  UpdateEventInput,
  AssignExamInput,
} from '@uniclub/shared';
import { WeeklyEventConfigService } from './weekly-event-config.service';
import { WeeklyEventStateMachine } from './weekly-event-state-machine.service';

export class WeeklyEventService {
  /**
   * Lấy danh sách event với filter & phân trang.
   */
  static async listEvents(params: {
    status?: WeeklyEventStatus;
    weekNumber?: number;
    year?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: WeeklyEvent[]; total: number; page: number; pageSize: number }> {
    const { status, weekNumber, year, page = 1, pageSize = 20 } = params;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (weekNumber) filter.weekNumber = weekNumber;
    if (year) filter.year = year;

    const [docs, total] = await Promise.all([
      WeeklyEventModel.find(filter)
        .sort({ scheduledStartAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      WeeklyEventModel.countDocuments(filter),
    ]);

    return {
      items: docs.map(this.toEvent),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Lấy chi tiết 1 event.
   */
  static async getEventById(id: string): Promise<WeeklyEvent | null> {
    const cacheKey = `${WEEKLY_EVENT_REDIS_KEYS.EVENT}:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const doc = await WeeklyEventModel.findById(id).lean();
    if (!doc) return null;

    const event = this.toEvent(doc);
    await redis.set(cacheKey, JSON.stringify(event), 'EX', WEEKLY_EVENT_EVENT_CACHE_TTL);
    return event;
  }

  /**
   * Lấy event đang diễn ra (cho UI-S-001).
   */
  static async getCurrentEvent(): Promise<WeeklyEvent | null> {
    const doc = await WeeklyEventModel.findOne({
      status: { $in: ['Waiting', 'InProgress', 'Grading', 'Showing'] },
    })
      .sort({ scheduledStartAt: -1 })
      .lean();

    return doc ? this.toEvent(doc) : null;
  }

  /**
   * Tạo event thủ công (nếu cần).
   */
  static async createEvent(input: CreateEventInput, createdBy?: string): Promise<WeeklyEvent> {
    const config = await WeeklyEventConfigService.getGeneralConfig();

    // Mỗi (tuần, năm) chỉ được phép có 1 sự kiện (unique index weekNumber_1_year_1).
    // Kiểm tra trước để báo lỗi tiếng Việt dễ hiểu thay vì trả về lỗi E11000 của MongoDB.
    const duplicate = await WeeklyEventModel.findOne({
      weekNumber: input.weekNumber,
      year: input.year,
    }).lean();
    if (duplicate) {
      throw new Error(
        `Đã tồn tại sự kiện cho tuần ${input.weekNumber} năm ${input.year}. Vui lòng chọn tuần khác.`,
      );
    }

    const doc = await WeeklyEventModel.create({
      weekNumber: input.weekNumber,
      year: input.year,
      title: input.title,
      scheduledStartAt: new Date(input.scheduledStartAt),
      waitingDuration: config.defaultWaitingDuration,
      examDuration: config.defaultExamDuration,
      leaderboardDuration: config.defaultLeaderboardDuration,
      questionCountOverride: WEEKLY_EVENT_DEFAULT_QUESTION_COUNT,
      activeGrades: input.activeGrades || config.defaultActiveGrades,
      status: 'Draft',
      examAssignments: {},
      createdBy: createdBy || 'system',
    }).catch((err: any) => {
      // Bắt lỗi trùng key trong trường hợp tạo đồng thời (race condition) lọt qua kiểm tra trên.
      if (err?.code === 11000) {
        throw new Error(
          `Đã tồn tại sự kiện cho tuần ${input.weekNumber} năm ${input.year}. Vui lòng chọn tuần khác.`,
        );
      }
      throw err;
    });

    // Tạo rooms cho từng khối
    const activeGrades = input.activeGrades || config.defaultActiveGrades;
    await WeeklyEventRoomModel.insertMany(
      activeGrades.map((grade) => ({
        eventId: doc._id,
        grade,
        status: 'Waiting',
        stateTransitions: [],
        participantCount: 0,
        submittedCount: 0,
      })),
    );

    return this.toEvent(doc);
  }

  /**
   * Cập nhật event. Chặn nếu status=Live.
   * Khi thay đổi activeGrades, đồng bộ rooms: tạo mới cho khối thêm vào, xóa khối bị loại bỏ.
   */
  static async updateEvent(id: string, input: UpdateEventInput): Promise<WeeklyEvent | null> {
    const event = await WeeklyEventModel.findById(id).lean();
    if (!event) return null;

    if (!['Draft', 'Scheduled'].includes(event.status)) {
      throw new Error('Chỉ có thể chỉnh sửa sự kiện ở trạng thái Bản nháp hoặc Đã lên lịch');
    }

    const update: Record<string, unknown> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.scheduledStartAt !== undefined) update.scheduledStartAt = new Date(input.scheduledStartAt);
    if (input.waitingDuration !== undefined) update.waitingDuration = input.waitingDuration;
    if (input.examDuration !== undefined) update.examDuration = input.examDuration;
    if (input.leaderboardDuration !== undefined) update.leaderboardDuration = input.leaderboardDuration;
    if (input.questionCountOverride !== undefined) update.questionCountOverride = input.questionCountOverride;
    if (input.activeGrades !== undefined) update.activeGrades = input.activeGrades;

    const doc = await WeeklyEventModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) return null;

    // Đồng bộ rooms khi activeGrades thay đổi
    if (input.activeGrades !== undefined) {
      const newGrades = input.activeGrades;
      const oldGrades = event.activeGrades;

      // Tạo rooms cho khối mới thêm vào
      const addedGrades = newGrades.filter((g) => !oldGrades.includes(g));
      if (addedGrades.length > 0) {
        await WeeklyEventRoomModel.insertMany(
          addedGrades.map((grade) => ({
            eventId: id,
            grade,
            status: 'Waiting',
            stateTransitions: [],
            participantCount: 0,
            submittedCount: 0,
          })),
        );
      }

      // Xóa rooms cho khối bị loại bỏ (chỉ xóa nếu chưa có ai tham gia)
      const removedGrades = oldGrades.filter((g) => !newGrades.includes(g));
      if (removedGrades.length > 0) {
        await WeeklyEventRoomModel.deleteMany({
          eventId: id,
          grade: { $in: removedGrades },
          participantCount: 0,
        });
      }

      // Dọn examAssignments cho khối đã bị loại bỏ
      const examAssignments = { ...(event.examAssignments || {}) };
      let assignmentsChanged = false;
      for (const grade of removedGrades) {
        if (examAssignments[String(grade)]) {
          delete examAssignments[String(grade)];
          assignmentsChanged = true;
        }
      }
      if (assignmentsChanged) {
        await WeeklyEventModel.findByIdAndUpdate(id, { $set: { examAssignments } });
      }
    }

    // Event đã publish (Scheduled) → đồng bộ lại room state trong Redis theo lịch mới.
    // nextTransitionAt + TTL của key roomstate được tính từ timeline CŨ lúc publish;
    // nếu không refresh, dời event ra sau có thể làm key hết hạn trước giờ bắt đầu mới
    // → scheduler mất state → event kẹt vĩnh viễn, frontend treo.
    if (event.status === 'Scheduled') {
      const timing = {
        scheduledStartAt: doc.scheduledStartAt,
        waitingDuration: doc.waitingDuration,
        examDuration: doc.examDuration,
        leaderboardDuration: doc.leaderboardDuration,
      };

      for (const grade of doc.activeGrades) {
        // Chỉ ghi đè khi room chưa chạy (missing hoặc còn Scheduled) —
        // tránh race hiếm khi room vừa chuyển Waiting đúng lúc admin bấm lưu
        const currentState = await WeeklyEventStateMachine.getState(id, grade);
        if (currentState && currentState !== ('Scheduled' as any)) continue;

        await WeeklyEventStateMachine.initRoomState(
          id,
          grade,
          new Date(doc.scheduledStartAt).toISOString(),
          timing,
        );
      }

      // Dọn Redis state của các khối bị loại bỏ
      const removedGrades = event.activeGrades.filter((g) => !doc.activeGrades.includes(g));
      if (removedGrades.length > 0) {
        await WeeklyEventStateMachine.cleanupEventState(id, removedGrades);
      }

      // Arm timer theo lịch mới — timer cũ tự no-op vì key timer chứa deadline cũ
      // (dynamic import để tránh circular dependency với scheduler)
      const { WeeklyEventSchedulerService } = await import('./weekly-event-scheduler.service');
      for (const grade of doc.activeGrades) {
        WeeklyEventSchedulerService.armTransitionTimer(id, grade, new Date(doc.scheduledStartAt));
      }
    }

    await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EVENT}:${id}`);
    return this.toEvent(doc);
  }

  /**
   * Gán đề cho 1 khối.
   */
  static async assignExam(eventId: string, input: AssignExamInput): Promise<WeeklyEvent | null> {
    const event = await WeeklyEventModel.findById(eventId).lean();
    if (!event) throw new Error('EVENT_NOT_FOUND');

    if (!['Draft', 'Scheduled'].includes(event.status)) {
      throw new Error('Chỉ có thể gán đề cho sự kiện ở trạng thái Bản nháp hoặc Đã lên lịch');
    }

    const examAssignments = { ...(event.examAssignments || {}) };
    examAssignments[String(input.grade)] = input.examId;

    const doc = await WeeklyEventModel.findByIdAndUpdate(
      eventId,
      { $set: { examAssignments } },
      { new: true },
    ).lean();

    // Đồng thời cập nhật room
    await WeeklyEventRoomModel.findOneAndUpdate(
      { eventId, grade: input.grade },
      { $set: { examId: input.examId } },
    );

    await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EVENT}:${eventId}`);
    return doc ? this.toEvent(doc) : null;
  }

  /**
   * Publish event: Draft → Scheduled.
   * Validate tất cả activeGrades phải có examId.
   */
  static async publishEvent(id: string): Promise<WeeklyEvent> {
    const event = await WeeklyEventModel.findById(id).lean();
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.status !== 'Draft') throw new Error('Chỉ có thể publish event ở trạng thái Draft');

    // Validate: tất cả activeGrades phải có examId
    const missingGrades: number[] = [];
    for (const grade of event.activeGrades) {
      if (!event.examAssignments || !event.examAssignments[String(grade)]) {
        missingGrades.push(grade);
      }
    }
    if (missingGrades.length > 0) {
      throw new Error(`Chưa gán đề cho các khối: ${missingGrades.join(', ')}`);
    }

    const doc = await WeeklyEventModel.findByIdAndUpdate(
      id,
      { $set: { status: 'Scheduled' } },
      { new: true },
    ).lean();
    if (!doc) throw new Error('EVENT_NOT_FOUND');

    // Khởi tạo room state trong Redis
    for (const grade of event.activeGrades) {
      await WeeklyEventStateMachine.initRoomState(id, grade, event.scheduledStartAt.toISOString(), {
        scheduledStartAt: event.scheduledStartAt,
        waitingDuration: event.waitingDuration,
        examDuration: event.examDuration,
        leaderboardDuration: event.leaderboardDuration,
      });
    }

    // Arm timer mở event đúng giờ trên instance này — phòng trường hợp publish sát giờ bắt đầu,
    // không kịp đợi tick kế tiếp của scheduler quét và arm.
    // (Dynamic import để tránh circular dependency với scheduler.)
    const { WeeklyEventSchedulerService } = await import('./weekly-event-scheduler.service');
    for (const grade of event.activeGrades) {
      WeeklyEventSchedulerService.armTransitionTimer(id, grade, new Date(event.scheduledStartAt));
    }

    await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EVENT}:${id}`);
    return this.toEvent(doc);
  }

  /**
   * Cancel event (chỉ super admin, chỉ khi state ∈ {Scheduled, Waiting, InProgress}).
   */
  static async cancelEvent(id: string, reason: string): Promise<WeeklyEvent> {
    const event = await WeeklyEventModel.findById(id).lean();
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const cancellableStates = ['Scheduled', 'Waiting', 'InProgress'];
    if (!cancellableStates.includes(event.status)) {
      throw new Error(`Không thể hủy event ở trạng thái ${event.status}`);
    }

    const doc = await WeeklyEventModel.findByIdAndUpdate(
      id,
      { $set: { status: 'Cancelled' } },
      { new: true },
    ).lean();
    if (!doc) throw new Error('EVENT_NOT_FOUND');

    // Cập nhật tất cả rooms
    await WeeklyEventRoomModel.updateMany(
      { eventId: id },
      { $set: { status: 'Cancelled' } },
    );

    // Cleanup Redis state
    await WeeklyEventStateMachine.cleanupEventState(id, event.activeGrades);

    await redis.del(`${WEEKLY_EVENT_REDIS_KEYS.EVENT}:${id}`);
    return this.toEvent(doc);
  }

  /**
   * FLOW-001: Auto-generate event cho tuần tiếp theo.
   * Chạy bởi cron job Chủ nhật 00:00.
   */
  static async autoGenerateWeeklyEvent(): Promise<WeeklyEvent | null> {
    const config = await WeeklyEventConfigService.getGeneralConfig();

    // Tính thứ Bảy tiếp theo
    const now = new Date();
    const nextSaturday = this.getNextSaturday(now);

    // Tính weekNumber và year
    const weekNumber = this.getISOWeekNumber(nextSaturday);
    const year = nextSaturday.getFullYear();

    // Kiểm tra đã tồn tại chưa
    const existing = await WeeklyEventModel.findOne({ weekNumber, year }).lean();

    if (existing) return null;

    const title = `Sự kiện tuần Số ${weekNumber}: Thử Thách Tuần`;

    const doc = await WeeklyEventModel.create({
      weekNumber,
      year,
      title,
      scheduledStartAt: nextSaturday,
      waitingDuration: config.defaultWaitingDuration,
      examDuration: config.defaultExamDuration,
      leaderboardDuration: config.defaultLeaderboardDuration,
      questionCountOverride: WEEKLY_EVENT_DEFAULT_QUESTION_COUNT,
      activeGrades: config.defaultActiveGrades,
      status: 'Draft',
      examAssignments: {},
      createdBy: 'system',
    });

    // Tạo 9 rooms
    await WeeklyEventRoomModel.insertMany(
      config.defaultActiveGrades.map((grade) => ({
        eventId: doc._id,
        grade,
        status: 'Waiting',
        stateTransitions: [],
        participantCount: 0,
        submittedCount: 0,
      })),
    );

    return this.toEvent(doc);
  }

  static async getRooms(eventId: string): Promise<Array<{
    grade: number;
    status: string;
    participantCount: number;
    submittedCount: number;
    examId?: string;
  }>> {
    const rooms = await WeeklyEventRoomModel.find({ eventId }).sort({ grade: 1 }).lean();
    return Promise.all(
      rooms.map(async (r) => {
        const joinedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.JOINED(eventId)}:${r.grade}`;
        const submittedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.SUBMITTED(eventId)}:${r.grade}`;

        const [redisPartCount, redisSubCount] = await Promise.all([
          redis.scard(joinedSetKey),
          redis.scard(submittedSetKey),
        ]);

        return {
          grade: r.grade,
          status: r.status,
          participantCount: redisPartCount > 0 ? redisPartCount : r.participantCount,
          submittedCount: redisSubCount > 0 ? redisSubCount : r.submittedCount,
          examId: r.examId,
        };
      })
    );
  }

  // ---- Helpers ----

  private static toEvent(doc: any): WeeklyEvent {
    return {
      _id: String(doc._id),
      weekNumber: doc.weekNumber as number,
      year: doc.year as number,
      title: doc.title as string,
      scheduledStartAt: (doc.scheduledStartAt as Date).toISOString(),
      actualStartAt: doc.actualStartAt?.toISOString() || null,
      actualEndAt: doc.actualEndAt?.toISOString() || null,
      waitingDuration: doc.waitingDuration as number,
      examDuration: doc.examDuration as number,
      leaderboardDuration: doc.leaderboardDuration as number,
      questionCountOverride: doc.questionCountOverride as number,
      activeGrades: doc.activeGrades as number[],
      status: doc.status as WeeklyEventStatus,
      examAssignments: (doc.examAssignments as Record<string, string>) || {},
      createdAt: doc.createdAt?.toISOString(),
      createdBy: doc.createdBy as string | undefined,
    };
  }

  private static getNextSaturday(from: Date): Date {
    const result = new Date(from);
    const day = result.getDay(); // 0=CN, 6=T7
    const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilSaturday);
    result.setHours(10, 0, 0, 0); // 10:00 AM
    return result;
  }

  private static getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
