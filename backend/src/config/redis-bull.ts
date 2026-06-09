import Redis from 'ioredis';
import { env } from './env';

/**
 * Tạo kết nối Redis dành riêng cho BullMQ.
 * Bắt buộc phải có `maxRetriesPerRequest: null` đối với BullMQ connection (đặc biệt là Worker).
 */
export function createBullRedisConnection(): Redis {
  if (env.REDIS_MODE === 'cluster') {
    const nodes = env.REDIS_CLUSTER_NODES.split(',').map((node) => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port, 10) };
    });

    return new Redis.Cluster(nodes, {
      redisOptions: {
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      },
      lazyConnect: true,
    }) as unknown as Redis;
  }

  // Standalone
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}
