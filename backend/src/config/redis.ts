import Redis from 'ioredis';
import { env } from './env';

function createRedisClient(): Redis {
  if (env.REDIS_MODE === 'cluster') {
    const nodes = env.REDIS_CLUSTER_NODES.split(',').map((node) => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port, 10) };
    });

    return new Redis.Cluster(nodes, {
      redisOptions: {
        password: env.REDIS_PASSWORD || undefined,
      },
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
    await redis.connect();
    console.log(`[Redis] Connected (${env.REDIS_MODE})`);
  } catch (error) {
    console.error('[Redis] Connection error:', error);
    process.exit(1);
  }
}
