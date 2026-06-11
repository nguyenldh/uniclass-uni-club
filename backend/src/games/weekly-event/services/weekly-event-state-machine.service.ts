// ============================================================
// Weekly Event — State Machine Service
// Điều khiển vòng đời phòng thi (FLOW-002)
// ============================================================

import { redis } from '../../../config/index';
import { WeeklyEventRoomModel } from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_TRANSITION_LOCK_TTL,
  WEEKLY_EVENT_REDIS_TTL_BUFFER,
  WEEKLY_EVENT_DEFAULT_KEY_TTL,
  WEEKLY_EVENT_MAX_GRADING_MINUTES,
} from '@uniclub/shared';
import type { WeeklyEventRoomStatus } from '@uniclub/shared';

export class WeeklyEventStateMachine {
  /**
   * Thực hiện transition phòng sang trạng thái mới.
   * Idempotent: nếu đã ở trạng thái đích → bỏ qua.
   */
  static async transition(
    eventId: string,
    grade: number,
    toState: WeeklyEventRoomStatus,
    nextTransitionAt?: string,
  ): Promise<{ success: boolean; alreadyInState: boolean }> {
    const lockKey = `${WEEKLY_EVENT_REDIS_KEYS.LOCK_TRANSITION(eventId)}:${grade}`;
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;

    // Acquire lock
    const locked = await redis.set(lockKey, '1', 'EX', WEEKLY_EVENT_TRANSITION_LOCK_TTL, 'NX');
    if (!locked) {
      // Lock đang được giữ bởi instance khác → thử lại sau
      return { success: false, alreadyInState: false };
    }

    try {
      // Kiểm tra state hiện tại
      const currentState = await redis.hget(roomStateKey, 'status');
      if (currentState === toState) {
        return { success: true, alreadyInState: true };
      }

      const now = new Date();
      const nowISO = now.toISOString();

      const stateData: Record<string, string> = {
        status: toState,
        transitionedAt: nowISO,
      };

      if (nextTransitionAt) {
        stateData.nextTransitionAt = nextTransitionAt;
      } else {
        await redis.hdel(roomStateKey, 'nextTransitionAt');
      }

      // Cập nhật Redis (DATA-R-006)
      await redis.hset(roomStateKey, stateData);

      // Persist xuống MongoDB (DATA-M-003)
      await WeeklyEventRoomModel.findOneAndUpdate(
        { eventId, grade },
        {
          $set: { status: toState },
          $push: {
            stateTransitions: { to: toState, at: now },
          },
        },
      );

      return { success: true, alreadyInState: false };
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * Lấy trạng thái hiện tại của phòng từ Redis.
   */
  static async getState(eventId: string, grade: number): Promise<WeeklyEventRoomStatus | null> {
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;
    const status = await redis.hget(roomStateKey, 'status');
    return status as WeeklyEventRoomStatus | null;
  }

  /**
   * Lấy trạng thái + deadline transition kế tiếp của phòng từ Redis.
   * Dùng cho scheduler khi deadline không tính trước được từ timeline tĩnh
   * (vd: Showing bắt đầu sớm vì chấm bài xong trước hạn).
   */
  static async getStateData(
    eventId: string,
    grade: number,
  ): Promise<{ status: WeeklyEventRoomStatus; nextTransitionAt?: string } | null> {
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;
    const state = await redis.hgetall(roomStateKey);
    if (!state || !state.status) return null;
    return {
      status: state.status as WeeklyEventRoomStatus,
      nextTransitionAt: state.nextTransitionAt || undefined,
    };
  }

  /**
   * Khởi tạo room state trong Redis (khi event được publish).
   * Ban đầu room ở trạng thái Scheduled — scheduler sẽ chuyển sang Waiting khi đến giờ.
   */
  static async initRoomState(
    eventId: string,
    grade: number,
    nextTransitionAt?: string,
    event?: { scheduledStartAt: Date | string; waitingDuration: number; examDuration: number; leaderboardDuration: number },
  ): Promise<void> {
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;
    const data: Record<string, string> = {
      status: 'Scheduled',
      transitionedAt: new Date().toISOString(),
    };
    if (nextTransitionAt) {
      data.nextTransitionAt = nextTransitionAt;
    }
    await redis.hset(roomStateKey, data);

    // Set TTL dựa trên event end + buffer
    if (event) {
      const ttl = this.getEventKeyTTL(event);
      await redis.expire(roomStateKey, ttl);
    }
  }

  /**
   * Tính TTL cho Redis key dựa trên thời gian kết thúc event + buffer.
   * Công thức: (scheduledStart + waiting + exam + max grading + leaderboard) - now + buffer
   */
  static getEventKeyTTL(event: {
    scheduledStartAt: Date | string;
    waitingDuration: number;
    examDuration: number;
    leaderboardDuration: number;
  }): number {
    const startMs = new Date(event.scheduledStartAt).getTime();
    const totalMin = event.waitingDuration + event.examDuration + WEEKLY_EVENT_MAX_GRADING_MINUTES + event.leaderboardDuration;
    const endMs = startMs + totalMin * 60000;
    const remainingSec = Math.ceil((endMs - Date.now()) / 1000);
    return Math.max(remainingSec, 0) + WEEKLY_EVENT_REDIS_TTL_BUFFER;
  }

  /**
   * Xóa toàn bộ Redis state của 1 event (cleanup sau khi Closed/Cancelled).
   */
  static async cleanupEventState(eventId: string, grades: number[]): Promise<void> {
    const keys: string[] = [];
    for (const grade of grades) {
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD(eventId)}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.LOCK_TRANSITION(eventId)}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.JOINED(eventId)}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.SUBMITTED(eventId)}:${grade}`);
    }
    // Keys không có grade suffix
    keys.push(`${WEEKLY_EVENT_REDIS_KEYS.AUTOSUBMIT_QUEUE(eventId)}`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
