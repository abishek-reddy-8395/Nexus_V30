/**
 * Nexus V30 — Redis Client
 *
 * Singleton Redis client (ioredis).
 * Used for: session cache, rate limiting store, WS subscription state,
 * BullMQ queue backend, price cache, alert trigger dedup.
 */

import Redis from 'ioredis';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('Redis');

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (_client) return _client;

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     true,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });

  _client.on('connect',   () => logger.info('Redis connected'));
  _client.on('error',     (err) => logger.warn('Redis error:', err.message));
  _client.on('reconnecting', () => logger.info('Redis reconnecting…'));

  return _client;
}

// Cache helpers
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await getRedisClient().get(key);
    if (!val) return null;
    try { return JSON.parse(val) as T; } catch { return val as unknown as T; }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await getRedisClient().setex(key, ttlSeconds, str);
    } else {
      await getRedisClient().set(key, str);
    }
  },

  async del(key: string): Promise<void> {
    await getRedisClient().del(key);
  },

  async exists(key: string): Promise<boolean> {
    return (await getRedisClient().exists(key)) === 1;
  },
};
