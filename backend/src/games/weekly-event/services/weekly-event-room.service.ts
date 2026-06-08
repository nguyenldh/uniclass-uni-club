// ============================================================
// Weekly Event — Room Service
// Quản lý join/leave room, online count (DATA-R-003, DATA-R-006)
// ============================================================

import { redis } from '../../../config/index';
import {
  WeeklyEventModel,
  WeeklyEventRoomModel,
  WeeklyEventParticipationModel,
} from '../../../models/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_ONLINE_COUNT_THROTTLE_MS,
  WEEKLY_EVENT_DEFAULT_KEY_TTL,
} from '@uniclub/shared';
import type { JoinEventResponse } from '@uniclub/shared';
import { WeeklyEventSocketService } from './weekly-event-socket.service';
import { WeeklyEventStateMachine } from './weekly-event-state-machine.service';
import crypto from 'crypto';

export class WeeklyEventRoomService {
  /**
   * FLOW-003 Pha 1: Học sinh join phòng chờ.
   * Validate state, upsert participation, tạo shuffleSeed, cấp socket token.
   */
  static async joinRoom(
    eventId: string,
    studentId: string,
    grade: number,
  ): Promise<JoinEventResponse> {
    // 1. Lấy event & room
    const event = await WeeklyEventModel.findById(eventId).lean();
    if (!event) throw new Error('EVENT_NOT_FOUND');

    // 2. Kiểm tra state phòng
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;
    const roomState = await redis.hgetall(roomStateKey);
    const status = roomState.status || 'Waiting';

    // Kiểm tra xem đã từng join trước đó chưa sử dụng Redis Set (joined)
    const joinedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.JOINED(eventId)}:${grade}`;
    const isJoinedInRedis = await redis.sismember(joinedSetKey, studentId);
    let isRejoining = isJoinedInRedis === 1;

    // Fallback kiểm tra DB nếu không tìm thấy trong Redis cache
    if (!isRejoining) {
      const existingParticipation = await WeeklyEventParticipationModel.findOne({ eventId, studentId }).lean();
      if (existingParticipation) {
        isRejoining = true;
        // Phục hồi lại Set trong Redis
        await redis.sadd(joinedSetKey, studentId);
      }
    }

    // Chỉ cho phép join mới khi Waiting hoặc InProgress (join muộn đến T+5)
    if (!isRejoining && !['Waiting', 'InProgress'].includes(status)) {
      throw new Error('EVENT_LATE');
    }

    // 3. Tìm room
    const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
    if (!room) throw new Error('ROOM_NOT_FOUND');

    // 4. Upsert participation (Chỉ thực hiện cho lần đầu join)
    if (!isRejoining) {
      const shuffleSeed = crypto.randomBytes(8).toString('hex');
      
      // Đảm bảo tính nguyên tử đa tiến trình trước khi tạo bản ghi MongoDB
      const added = await redis.sadd(joinedSetKey, studentId);
      if (added === 1) {
        try {
          await WeeklyEventParticipationModel.findOneAndUpdate(
            { eventId, studentId },
            {
              $setOnInsert: {
                eventId,
                roomId: room._id,
                studentId,
                grade,
                joinedAt: new Date(),
                shuffleSeed,
                disconnectCount: 0,
              },
            },
            { upsert: true, new: true },
          );
        } catch (err) {
          // Rollback Redis nếu ghi DB thất bại
          await redis.srem(joinedSetKey, studentId);
          throw err;
        }
      }
    }

    // 5. SADD vào online set
    const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
    await redis.sadd(onlineKey, studentId);

    // Set TTL cho joined & online sets dựa trên event end + buffer
    const keyTTL = WeeklyEventStateMachine.getEventKeyTTL(event);
    await redis.expire(joinedSetKey, keyTTL);
    await redis.expire(onlineKey, keyTTL);

    // 6. Cấp socket token
    const socketToken = WeeklyEventSocketService.createSocketToken(studentId, eventId, grade);

    return {
      roomId: String(room._id),
      status: status as JoinEventResponse['status'],
      socketToken,
      socketUrl: '/we',
    };
  }

  /**
   * Học sinh vào phòng (online).
   */
  static async enterRoom(eventId: string, studentId: string, grade: number): Promise<void> {
    const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
    await redis.sadd(onlineKey, studentId);
    // Set TTL fallback (key đã được set TTL chính xác từ joinRoom, đây là safety net)
    await redis.expire(onlineKey, WEEKLY_EVENT_DEFAULT_KEY_TTL);
  }

  /**
   * Học sinh rời phòng (disconnect).
   */
  static async leaveRoom(eventId: string, studentId: string, grade: number): Promise<void> {
    const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
    await redis.srem(onlineKey, studentId);
  }

  /**
   * Lấy số học sinh online trong phòng.
   */
  static async getOnlineCount(eventId: string, grade: number): Promise<number> {
    const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
    return redis.scard(onlineKey);
  }

  /**
   * Lấy danh sách học sinh online trong phòng.
   */
  static async getOnlineStudents(eventId: string, grade: number): Promise<string[]> {
    const onlineKey = `${WEEKLY_EVENT_REDIS_KEYS.ONLINE(eventId)}:${grade}`;
    return redis.smembers(onlineKey);
  }

  /**
   * Lấy trạng thái phòng từ Redis (DATA-R-006), fallback MongoDB.
   */
  static async getRoomState(eventId: string, grade: number): Promise<{
    status: string;
    transitionedAt: string;
    nextTransitionAt?: string;
  }> {
    const roomStateKey = `${WEEKLY_EVENT_REDIS_KEYS.ROOM_STATE(eventId)}:${grade}`;
    const state = await redis.hgetall(roomStateKey);

    if (state && state.status) {
      return {
        status: state.status,
        transitionedAt: state.transitionedAt || '',
        nextTransitionAt: state.nextTransitionAt || undefined,
      };
    }

    // Fallback MongoDB
    const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
    if (!room) throw new Error('ROOM_NOT_FOUND');

    return {
      status: room.status,
      transitionedAt: room.stateTransitions[room.stateTransitions.length - 1]?.at?.toISOString() || '',
    };
  }
}
