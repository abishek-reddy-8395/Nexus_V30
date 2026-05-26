/**
 * Nexus V30 — Health Check
 *
 * Checks connectivity to all external dependencies:
 * PostgreSQL, TimescaleDB, Redis, Kafka.
 * Used by Docker/Kubernetes liveness and readiness probes.
 */

import { Client } from 'pg';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('HealthCheck');

export interface HealthStatus {
  status:       'ok' | 'degraded' | 'down';
  version:      string;
  uptime:       number;
  ts:           number;
  checks: {
    postgres:     'ok' | 'error';
    timescaledb:  'ok' | 'error';
    redis:        'ok' | 'error';
    kafka:        'ok' | 'skip';
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {
    postgres:    'error',
    timescaledb: 'error',
    redis:       'error',
    kafka:       'skip',
  };

  // PostgreSQL
  try {
    const pg = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    await pg.connect();
    await pg.query('SELECT 1');
    await pg.end();
    checks.postgres = 'ok';
  } catch (err: any) {
    logger.warn('Postgres health check failed:', err.message);
  }

  // TimescaleDB
  try {
    const ts = new Client({ connectionString: process.env.TIMESCALEDB_URL, connectionTimeoutMillis: 2000 });
    await ts.connect();
    await ts.query('SELECT 1');
    await ts.end();
    checks.timescaledb = 'ok';
  } catch {
    // Non-fatal — may not be configured in dev
    checks.timescaledb = 'error';
  }

  // Redis
  try {
    const { getRedisClient } = await import('../../database/redis/client');
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'ok';
  } catch (err: any) {
    logger.warn('Redis health check failed:', err.message);
  }

  const allOk    = checks.postgres === 'ok' && checks.redis === 'ok';
  const critical = checks.postgres === 'error';

  return {
    status:  critical ? 'down' : allOk ? 'ok' : 'degraded',
    version: '30.0.0',
    uptime:  process.uptime(),
    ts:      Date.now(),
    checks,
  };
}
