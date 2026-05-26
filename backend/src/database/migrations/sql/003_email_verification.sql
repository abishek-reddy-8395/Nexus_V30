-- Nexus V30 — Migration 003: Email verification & password reset
-- Run via: pnpm db:migrate

-- Add email verification fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified         BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verify_token      TEXT,
  ADD COLUMN IF NOT EXISTS email_verify_token_exp  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_token    TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_token_exp TIMESTAMPTZ;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users (email_verify_token) WHERE email_verify_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Create executions table (Prisma handles this via migrate dev, but raw SQL ensures TimescaleDB clusters get it too)
CREATE TABLE IF NOT EXISTS executions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sym          VARCHAR(20)  NOT NULL,
  dir          VARCHAR(4)   NOT NULL CHECK (dir IN ('BUY', 'SELL')),
  entry        NUMERIC(20,8) NOT NULL,
  sl           NUMERIC(20,8) NOT NULL,
  tp           NUMERIC(20,8),
  lots         NUMERIC(10,4) NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  risk_calc    JSONB,
  preview      JSONB,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_user_id   ON executions (user_id);
CREATE INDEX IF NOT EXISTS idx_executions_tenant_id ON executions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_executions_status    ON executions (status);
