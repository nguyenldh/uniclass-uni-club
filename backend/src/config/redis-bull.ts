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

    const isLocalhost = nodes.some((n) => n.host === 'localhost' || n.host === '127.0.0.1');

    return new Redis.Cluster(nodes, {
      redisOptions: {
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      },
      // Đồng bộ với config/redis.ts: khi chạy từ host Windows nối tới cluster
      // trong Docker, ioredis nhận IP nội bộ Docker (172.x.x.x) không route được.
      // Thiếu natMap ở đây làm BullMQ (toàn bộ hệ timer) âm thầm không kết nối được.
      natMap: isLocalhost
        ? (key: string) => {
            const [host, portStr] = key.split(':');
            const port = parseInt(portStr, 10);
            return host !== '127.0.0.1' && host !== 'localhost' ? { host: '127.0.0.1', port } : null;
          }
        : undefined,
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
