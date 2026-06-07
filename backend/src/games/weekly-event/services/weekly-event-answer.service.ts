// ============================================================
// Weekly Event — Answer Service
// Xử lý submit đáp án, rate limit, buffer (FLOW-006)
// ============================================================

import { redis } from '../../../config/index';
import {
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_SUBMIT_RATE_LIMIT,
} from '@uniclub/shared';
import type { AnswerAckPayload } from '@uniclub/shared';

export class WeeklyEventAnswerService {
  /**
   * FLOW-006: Submit 1 đáp án.
   * Validate state, rate limit, HSET vào buffer.
   */
  static async submitAnswer(
    eventId: string,
    studentId: string,
    questionId: string,
    key: string,
  ): Promise<AnswerAckPayload> {
    // 1. Rate limit check (DATA-R-008)
    const rlKey = `${WEEKLY_EVENT_REDIS_KEYS.RL_SUBMIT}:${eventId}:${studentId}`;
    const currentCount = await redis.incr(rlKey);
    if (currentCount === 1) {
      await redis.expire(rlKey, 1); // TTL 1 giây
    }
    if (currentCount > WEEKLY_EVENT_SUBMIT_RATE_LIMIT) {
      throw new Error('RATE_LIMITED');
    }

    // 2. Lưu đáp án vào buffer (DATA-R-005)
    const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${studentId}`;
    const answerData = JSON.stringify({ key, at: Date.now() });
    await redis.hset(answersKey, questionId, answerData);

    // 3. Đếm số câu đã trả lời
    const answeredCount = await redis.hlen(answersKey);

    return {
      questionId,
      savedAt: new Date().toISOString(),
      answeredCount,
    };
  }

  /**
   * Lấy toàn bộ đáp án đã lưu của học sinh.
   */
  static async getAnswers(
    eventId: string,
    studentId: string,
  ): Promise<Record<string, { key: string; at: number }>> {
    const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${studentId}`;
    const raw = await redis.hgetall(answersKey);

    const result: Record<string, { key: string; at: number }> = {};
    for (const [questionId, data] of Object.entries(raw)) {
      try {
        result[questionId] = JSON.parse(data);
      } catch {
        // ignore malformed data
      }
    }
    return result;
  }

  /**
   * Đánh dấu học sinh nộp bài sớm (manual submit).
   * Đẩy studentId vào auto-submit queue.
   */
  static async submitFinal(eventId: string, studentId: string): Promise<void> {
    const queueKey = `${WEEKLY_EVENT_REDIS_KEYS.AUTOSUBMIT_QUEUE}:${eventId}`;
    await redis.lpush(queueKey, studentId);
  }

  /**
   * Đẩy tất cả học sinh chưa submit vào queue (tại T+25).
   */
  static async enqueueAllUnsubmitted(
    eventId: string,
    grade: number,
    allStudents: string[],
    submittedStudents: Set<string>,
  ): Promise<void> {
    const queueKey = `${WEEKLY_EVENT_REDIS_KEYS.AUTOSUBMIT_QUEUE}:${eventId}`;
    const unsubmitted = allStudents.filter((s) => !submittedStudents.has(s));

    if (unsubmitted.length > 0) {
      await redis.lpush(queueKey, ...unsubmitted);
    }
  }

  /**
   * Pop 1 student từ queue để xử lý.
   */
  static async popFromQueue(eventId: string): Promise<string | null> {
    const queueKey = `${WEEKLY_EVENT_REDIS_KEYS.AUTOSUBMIT_QUEUE}:${eventId}`;
    return redis.rpop(queueKey);
  }

  /**
   * Kiểm tra queue còn phần tử không.
   */
  static async getQueueLength(eventId: string): Promise<number> {
    const queueKey = `${WEEKLY_EVENT_REDIS_KEYS.AUTOSUBMIT_QUEUE}:${eventId}`;
    return redis.llen(queueKey);
  }

  /**
   * Xóa buffer đáp án của 1 học sinh (sau khi đã chấm xong).
   */
  static async clearAnswers(eventId: string, studentId: string): Promise<void> {
    const answersKey = `${WEEKLY_EVENT_REDIS_KEYS.ANSWERS}:${eventId}:${studentId}`;
    await redis.del(answersKey);
  }
}
