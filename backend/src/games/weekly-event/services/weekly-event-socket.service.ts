// ============================================================
// Weekly Event — Socket Service
// Quản lý socket token, mapping, multi-tab detection (DATA-R-010)
// ============================================================

import jwt from 'jsonwebtoken';
import { redis, env } from '../../../config/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_SOCKET_TOKEN_TTL,
} from '@uniclub/shared';

export interface WeeklyEventSocketTokenPayload {
  studentId: string;
  eventId: string;
  grade: number;
  iat?: number;
  exp?: number;
}

export class WeeklyEventSocketService {
  /**
   * Tạo socket token short-lived (60s) cho học sinh.
   */
  static createSocketToken(studentId: string, eventId: string, grade: number): string {
    return jwt.sign(
      { studentId, eventId, grade },
      env.JWT_SECRET,
      { expiresIn: WEEKLY_EVENT_SOCKET_TOKEN_TTL },
    );
  }

  /**
   * Verify socket token.
   */
  static verifySocketToken(token: string): WeeklyEventSocketTokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as WeeklyEventSocketTokenPayload;
  }

  /**
   * Đăng ký socket mapping khi học sinh connect.
   * Lưu hash: we:{eventId}:socket:{studentId} và reverse string: we:{eventId}:socket-reverse:{socketId}
   */
  static async registerSocketMapping(
    eventId: string,
    studentId: string,
    socketId: string,
    beInstanceId: string,
  ): Promise<void> {
    const hashKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_MAPPING}:${eventId}:${studentId}`;
    const reverseKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_REVERSE}:${eventId}:${socketId}`;

    const now = Date.now().toString();

    await redis
      .multi()
      .hset(hashKey, {
        socketId,
        beInstanceId,
        connectedAt: now,
        lastActivityAt: now,
      })
      .set(reverseKey, studentId)
      .exec();
  }

  /**
   * Cập nhật lastActivityAt.
   */
  static async touchActivity(eventId: string, studentId: string): Promise<void> {
    const hashKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_MAPPING}:${eventId}:${studentId}`;
    await redis.hset(hashKey, 'lastActivityAt', Date.now().toString());
  }

  /**
   * Xóa socket mapping khi disconnect.
   */
  static async removeSocketMapping(eventId: string, studentId: string, socketId: string): Promise<void> {
    const hashKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_MAPPING}:${eventId}:${studentId}`;
    const reverseKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_REVERSE}:${eventId}:${socketId}`;

    await redis
      .multi()
      .hset(hashKey, 'disconnectedAt', Date.now().toString())
      .del(reverseKey)
      .exec();
  }

  /**
   * Phát hiện multi-tab: nếu studentId đã có socket cũ còn sống → trả về socketId cũ.
   * Trả về null nếu không có conflict.
   */
  static async detectMultiTab(eventId: string, studentId: string): Promise<string | null> {
    const hashKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_MAPPING}:${eventId}:${studentId}`;
    const existing = await redis.hgetall(hashKey);

    if (existing && existing.socketId && !existing.disconnectedAt) {
      return existing.socketId;
    }
    return null;
  }

  /**
   * Lấy socketId hiện tại của student.
   */
  static async getSocketId(eventId: string, studentId: string): Promise<string | null> {
    const hashKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_MAPPING}:${eventId}:${studentId}`;
    const socketId = await redis.hget(hashKey, 'socketId');
    return socketId || null;
  }

  /**
   * Lấy studentId từ socketId (reverse lookup).
   */
  static async getStudentIdBySocket(eventId: string, socketId: string): Promise<string | null> {
    const reverseKey = `${WEEKLY_EVENT_REDIS_KEYS.SOCKET_REVERSE}:${eventId}:${socketId}`;
    return redis.get(reverseKey);
  }
}
