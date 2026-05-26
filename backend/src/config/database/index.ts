/**
 * Nexus V30 — Database Configuration
 * Connection settings for PostgreSQL, TimescaleDB, and Redis.
 */
export const dbConfig = {
  postgres: {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus_v30_dev',
    max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000,
  },
  timescaledb: {
    connectionString: process.env.TIMESCALEDB_URL ?? 'postgresql://nexus:nexus@localhost:5433/nexus_v30_timeseries',
    max: 10, idleTimeoutMillis: 30_000,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    retryDelayMs: 200, maxRetries: 3,
  },
};
