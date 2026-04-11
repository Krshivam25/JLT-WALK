import IORedis from 'ioredis';
import { config } from './index.js';

let redis: any = null;
let redisAvailable = false;

export function initRedis(): void {
  if (!config.redisUrl) {
    console.log('Redis URL not configured — running without cache');
    return;
  }
  try {
    const RedisConstructor = (IORedis as any).default || IORedis;
    redis = new RedisConstructor(config.redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redis.on('connect', () => {
      redisAvailable = true;
      console.log('Redis connected');
    });
    redis.on('error', (err: Error) => {
      redisAvailable = false;
      console.warn('Redis error:', err.message);
    });
    redis.on('close', () => {
      redisAvailable = false;
    });
    redis.connect().catch(() => {
      console.warn('Redis connection failed — running without cache');
    });
  } catch {
    console.warn('Redis init failed — running without cache');
  }
}

export function getRedis(): any {
  return redisAvailable ? redis : null;
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value, 'EX', ttlSeconds);
  } catch {}
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {}
}
