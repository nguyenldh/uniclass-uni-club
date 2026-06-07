// ============================================================
// Weekly Event — State Machine Service
// Điều khiển vòng đời phòng thi (FLOW-002)
// ============================================================

import { redis } from '../../../config/index';
import { WeeklyEventRoomModel } from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_TRANSITION_LOCK_TTL,
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
  ): Promise<{ success: boolean; alreadyInState: boolean }> {
    const lockKey = `${WEEKLY_EVENT_REDIS_KEYS.LOCK_TRANSITION}:${eventId}:${grade}`;
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE}:${eventId}:${grade}`;

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

      // Cập nhật Redis (DATA-R-006)
      await redis.hset(roomStateKey, {
        status: toState,
        transitionedAt: nowISO,
      });

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
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE}:${eventId}:${grade}`;
    const status = await redis.hget(roomStateKey, 'status');
    return status as WeeklyEventRoomStatus | null;
  }

  /**
   * Khởi tạo room state trong Redis (khi event được publish).
   * Ban đầu room ở trạng thái Scheduled — scheduler sẽ chuyển sang Waiting khi đến giờ.
   */
  static async initRoomState(eventId: string, grade: number): Promise<void> {
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE}:${eventId}:${grade}`;
    await redis.hset(roomStateKey, {
      status: 'Scheduled',
      transitionedAt: new Date().toISOString(),
    });
  }

  /**
   * Xóa toàn bộ Redis state của 1 event (cleanup sau khi Closed/Cancelled).
   */
  static async cleanupEventState(eventId: string, grades: number[]): Promise<void> {
    const keys: string[] = [];
    for (const grade of grades) {
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE}:${eventId}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.ONLINE}:${eventId}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.LEADERBOARD}:${eventId}:${grade}`);
      keys.push(`${WEEKLY_EVENT_REDIS_KEYS.LOCK_TRANSITION}:${eventId}:${grade}`);
    }
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
