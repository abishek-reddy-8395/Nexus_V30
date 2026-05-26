-- Nexus V30 — Initial Schema Migration
-- Run: pnpm db:migrate
-- Creates: tenants, users, journal_entries, alerts, audit_log

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);

-- ── Journal entries ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sym              TEXT NOT NULL,
  dir              TEXT NOT NULL CHECK (dir IN ('BUY','SELL')),
  mode             TEXT NOT NULL CHECK (mode IN ('scalp','intraday','positional')),
  entry_price      NUMERIC,
  sl               NUMERIC,
  tp1              NUMERIC,
  rr               TEXT,
  conviction       INT CHECK (conviction BETWEEN 0 AND 100),
  result           TEXT CHECK (result IN ('win','loss','be')),
  pnl              NUMERIC,
  notes            TEXT,
  tags             TEXT[] DEFAULT '{}',
  confluence_score INT CHECK (confluence_score BETWEEN 0 AND 100),
  structure        TEXT,
  session          TEXT,
  signal           TEXT,
  ts               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_user   ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_ts     ON journal_entries(ts DESC);

-- ── Alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sym          TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('price','signal','confluence')),
  condition    JSONB NOT NULL DEFAULT '{}',
  label        TEXT,
  triggered    BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);

-- ── Audit log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  metadata    JSONB DEFAULT '{}',
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
