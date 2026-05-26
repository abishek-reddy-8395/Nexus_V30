/**
 * Nexus V30 — Environment Configuration
 *
 * Validates required environment variables at startup.
 * The app refuses to start in production if critical vars are missing.
 * In development, defaults are provided for convenience.
 */

const isProd = process.env.NODE_ENV === 'production';

function required(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    const msg = `[FATAL] Required environment variable "${key}" is not set.`;
    if (isProd) {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn(`[WARN] ${msg} (non-fatal in development)`);
      return '';
    }
  }
  return value;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

// Validate secret length in production
function secret(key: string, minLength = 32): string {
  const value = required(key, isProd ? undefined : `dev-${key.toLowerCase()}-placeholder-not-for-production`);
  if (isProd && value.length < minLength) {
    console.error(`[FATAL] "${key}" must be at least ${minLength} characters. Generate with: openssl rand -base64 32`);
    process.exit(1);
  }
  return value;
}

export const config = {
  NODE_ENV:       process.env.NODE_ENV ?? 'development',
  PORT:           parseInt(optional('PORT', '3001'), 10),
  FRONTEND_ORIGIN: optional('FRONTEND_ORIGIN', 'http://localhost:3000'),

  // Security — validated on startup
  JWT_SECRET:      secret('JWT_SECRET', 32),
  JWT_EXPIRES_IN:  optional('JWT_EXPIRES_IN', '7d'),
  ENCRYPTION_KEY:  secret('ENCRYPTION_KEY', 32),

  // Rate limiting
  DISABLE_RATE_LIMITS: process.env.DISABLE_RATE_LIMITS === 'true' && !isProd,

  // Databases
  DATABASE_URL:    required('DATABASE_URL', 'postgresql://nexus:nexus@localhost:5432/nexus_v30_dev'),
  TIMESCALEDB_URL: optional('TIMESCALEDB_URL', 'postgresql://nexus:nexus@localhost:5433/nexus_v30_timeseries'),
  REDIS_URL:       optional('REDIS_URL', 'redis://localhost:6379'),

  // Kafka
  KAFKA_BROKERS:   optional('KAFKA_BROKERS', 'localhost:9092'),
  KAFKA_CLIENT_ID: optional('KAFKA_CLIENT_ID', 'nexus-v30-backend'),

  // External APIs (optional)
  GEMINI_API_KEY:      optional('GEMINI_API_KEY'),
  OPENAI_API_KEY:      optional('OPENAI_API_KEY'),
  TWELVEDATA_API_KEY:  optional('TWELVEDATA_API_KEY'),
  BINANCE_API_KEY:     optional('BINANCE_API_KEY'),
  BINANCE_SECRET:      optional('BINANCE_SECRET'),

  // Stripe (optional — billing degrades gracefully without it)
  STRIPE_SECRET_KEY:          optional('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET:      optional('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRO_PRICE_ID:        optional('STRIPE_PRO_PRICE_ID'),
  STRIPE_ENTERPRISE_PRICE_ID: optional('STRIPE_ENTERPRISE_PRICE_ID'),

  // Cache TTLs
  PRICE_CACHE_TTL:  parseInt(optional('PRICE_CACHE_TTL',  '10'),  10),
  CANDLE_CACHE_TTL: parseInt(optional('CANDLE_CACHE_TTL', '30'),  10),

  // Monitoring
  LOG_LEVEL:                optional('LOG_LEVEL', 'info'),
  SENTRY_DSN:               optional('SENTRY_DSN'),
  OTEL_EXPORTER_ENDPOINT:   optional('OTEL_EXPORTER_OTLP_ENDPOINT'),
} as const;

export type Config = typeof config;
