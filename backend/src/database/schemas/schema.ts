/**
 * Nexus V30 — Database Schemas
 *
 * PostgreSQL schema definitions (Prisma-compatible).
 * Run: pnpm db:migrate to apply.
 *
 * Tables:
 *   tenants         — Multi-tenant organisations
 *   users           — Platform users (belongs to tenant)
 *   sessions        — Refresh token store
 *   journal_entries — Trade journal (per user)
 *   alerts          — User-defined price/signal alerts
 *   subscriptions   — Billing plans
 *   audit_log       — Immutable audit trail
 *
 * Time-series (TimescaleDB hypertables):
 *   candles         — OHLCV data (sym, tf, time)
 *   price_ticks     — Raw tick data
 *   signals         — Engine signal history
 */

// This file documents the schema — actual SQL is in database/migrations/
// When Prisma is wired: `prisma generate` produces typed client from schema.prisma

export const SCHEMA_VERSION = 3;

export const SCHEMA_DOCS = {
  tenants: `
    CREATE TABLE tenants (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

  users: `
    CREATE TABLE users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
      last_login    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_users_tenant ON users(tenant_id);
    CREATE INDEX idx_users_email  ON users(email);`,

  journal_entries: `
    CREATE TABLE journal_entries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sym             TEXT NOT NULL,
      dir             TEXT NOT NULL CHECK (dir IN ('BUY','SELL')),
      mode            TEXT NOT NULL CHECK (mode IN ('scalp','intraday','positional')),
      entry           NUMERIC,
      sl              NUMERIC,
      tp1             NUMERIC,
      rr              TEXT,
      conviction      INT,
      result          TEXT CHECK (result IN ('win','loss','be',NULL)),
      pnl             NUMERIC,
      notes           TEXT,
      tags            TEXT[],
      confluence_score INT,
      structure       TEXT,
      session         TEXT,
      signal          TEXT,
      ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_journal_user   ON journal_entries(user_id);
    CREATE INDEX idx_journal_tenant ON journal_entries(tenant_id);
    CREATE INDEX idx_journal_ts     ON journal_entries(ts DESC);`,

  candles: `
    -- TimescaleDB hypertable (partitioned by time)
    CREATE TABLE candles (
      sym       TEXT        NOT NULL,
      tf        INT         NOT NULL,
      time      TIMESTAMPTZ NOT NULL,
      open      NUMERIC     NOT NULL,
      high      NUMERIC     NOT NULL,
      low       NUMERIC     NOT NULL,
      close     NUMERIC     NOT NULL,
      volume    NUMERIC     NOT NULL DEFAULT 0,
      PRIMARY KEY (sym, tf, time)
    );
    SELECT create_hypertable('candles', 'time');
    CREATE INDEX idx_candles_sym_tf ON candles(sym, tf, time DESC);`,

  alerts: `
    CREATE TABLE alerts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sym         TEXT NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('price','signal','confluence')),
      condition   JSONB NOT NULL,
      triggered   BOOLEAN NOT NULL DEFAULT FALSE,
      triggered_at TIMESTAMPTZ,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

  audit_log: `
    CREATE TABLE audit_log (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      user_id     UUID,
      action      TEXT NOT NULL,
      resource    TEXT NOT NULL,
      resource_id TEXT,
      metadata    JSONB,
      ip          INET,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);`,
};
