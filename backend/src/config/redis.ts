import Redis from 'ioredis';
import { env } from './env';

function createRedisClient(): Redis {
  if (env.REDIS_MODE === 'cluster') {
    const nodes = env.REDIS_CLUSTER_NODES.split(',').map((node) => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port, 10) };
    });

    const isLocalhost = nodes.some(n => n.host === 'localhost' || n.host === '127.0.0.1');

    return new Redis.Cluster(nodes, {
      redisOptions: {
        password: env.REDIS_PASSWORD || undefined,
      },
      // Nếu chạy từ host máy Windows kết nối tới cluster trong Docker,
      // ioredis nhận được IP nội bộ Docker (172.x.x.x) sẽ không route được.
      // natMap chuyển hướng các IP nội bộ này về localhost (127.0.0.1) trên cùng cổng.
      natMap: isLocalhost 
        ? (key: string) => {
            const [host, portStr] = key.split(':');
            const port = parseInt(portStr, 10);
            const mapped = host !== '127.0.0.1' && host !== 'localhost' ? { host: '127.0.0.1', port } : null;
            console.log(`[Redis NAT] Mapping node "${key}" ->`, mapped);
            return mapped;
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
    lazyConnect: true,
  });
}

export const redis = createRedisClient();

export async function connectRedis(): Promise<void> {
  try {
    // redis.duplicate() (dùng bởi Socket.IO adapter) có thể đã kích hoạt kết nối
    if (redis.status === 'connecting' || redis.status === 'connect' || redis.status === 'ready') {
      console.log(`[Redis] Already connected (${env.REDIS_MODE})`);
      return;
    }
    await redis.connect();
    console.log(`[Redis] Connected (${env.REDIS_MODE})`);
  } catch (error) {
    console.error('[Redis] Connection error:', error);
    process.exit(1);
  }
}
