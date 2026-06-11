import crypto from 'node:crypto';
import { redis } from '../config/index';

// ============================================================
// Distributed lock trên Redis (SET NX PX + release bằng Lua)
// Dùng để serialize các thao tác get→mutate→set xuyên instance
// (queue matchmaking, game session...). Lock theo 1 key duy nhất
// nên tương thích cả Redis standalone lẫn cluster.
// ============================================================

/** Lua: chỉ xóa lock nếu token khớp — tránh release nhầm lock của instance khác */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface RedisLockOptions {
  /** TTL của lock (ms) — phòng instance giữ lock bị crash. Default 10s */
  ttlMs?: number;
  /** Khoảng nghỉ giữa các lần thử acquire (ms). Default 50ms */
  retryDelayMs?: number;
  /** Tổng thời gian chờ acquire tối đa (ms) trước khi throw. Default 5s */
  maxWaitMs?: number;
}

/**
 * Chạy `fn` dưới distributed lock `lockKey`.
 * Retry acquire đến `maxWaitMs`, hết thời gian thì throw.
 */
export async function withRedisLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  options: RedisLockOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 10_000;
  const retryDelayMs = options.retryDelayMs ?? 50;
  const maxWaitMs = options.maxWaitMs ?? 5_000;

  const token = crypto.randomUUID();
  const deadline = Date.now() + maxWaitMs;

  // Acquire
  for (;;) {
    const acquired = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (acquired) break;
    if (Date.now() >= deadline) {
      throw new Error(`Could not acquire lock "${lockKey}" within ${maxWaitMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  try {
    return await fn();
  } finally {
    try {
      await redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
    } catch {
      // Lock sẽ tự hết hạn theo TTL — không để lỗi release che lỗi nghiệp vụ
    }
  }
}
