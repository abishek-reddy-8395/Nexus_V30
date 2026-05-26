-- Nexus V30 — Migration 004: Enterprise SaaS Layer
-- Creates: organizations, org_memberships, org_settings, feature_flags,
--          subscriptions, api_keys, invitations, behavioral_events, trader_sessions

-- Organizations (root tenant entity for enterprise multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'starter',   -- starter | growth | enterprise | white_label
  schema_name  TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Org memberships (user ↔ org association with RBAC)
CREATE TABLE IF NOT EXISTS org_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'TRADER',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(org_id);

-- Org settings (branding, white-label config, tenant options)
CREATE TABLE IF NOT EXISTS org_settings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     JSONB NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(org_id, key)
);

-- Feature flags (per-org feature gates via Redis + DB)
CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key    TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct INT NOT NULL DEFAULT 100,
  UNIQUE(org_id, flag_key)
);

-- Subscriptions (Stripe billing state)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL,
  seats                INT NOT NULL DEFAULT 5,
  status               TEXT NOT NULL DEFAULT 'active',
  stripe_sub_id        TEXT,
  stripe_customer_id   TEXT,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_sub_id);

-- API keys (machine identity for partner integrations)
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash    TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  scopes      TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

-- Invitations (onboarding flow)
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'TRADER',
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_org   ON invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- Behavioral events (emotional trading, revenge trading, etc.)
CREATE TABLE IF NOT EXISTS behavioral_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  user_id      UUID NOT NULL,
  event_type   TEXT NOT NULL,  -- emotional_trade | revenge_trade | overtrade | fomo_entry | risk_drift | session_fatigue
  confidence   FLOAT NOT NULL DEFAULT 0,
  trigger_data JSONB,
  trade_id     UUID,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_behavioral_events_org_user ON behavioral_events(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_events_type     ON behavioral_events(org_id, event_type);
CREATE INDEX IF NOT EXISTS idx_behavioral_events_time     ON behavioral_events(created_at DESC);

-- Trader sessions (for engagement analytics)
CREATE TABLE IF NOT EXISTS trader_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  user_id       UUID NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  duration_secs INT,
  instruments   TEXT[] NOT NULL DEFAULT '{}',
  trade_count   INT NOT NULL DEFAULT 0,
  pnl           DECIMAL(18,6),
  ai_queries    INT NOT NULL DEFAULT 0,
  journal_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_trader_sessions_org_user ON trader_sessions(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trader_sessions_time     ON trader_sessions(started_at DESC);

-- Update audit_log to support org_id (for enterprise tenants)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS diff   JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS hash   TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id, created_at DESC);

-- ── pgvector for RAG (AI Copilot context retrieval) ───────────────────────────
-- Enable pgvector extension for semantic search / RAG pipeline
-- Run: CREATE EXTENSION IF NOT EXISTS vector;  (requires pgvector installed on Postgres)
-- Then run the migration below:
--
-- CREATE TABLE IF NOT EXISTS vector_chunks (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   org_id       UUID,
--   user_id      UUID,
--   source_type  TEXT NOT NULL,  -- 'journal' | 'engine_doc' | 'org_playbook' | 'smc_education'
--   source_id    TEXT,
--   content      TEXT NOT NULL,
--   embedding    vector(768),    -- Gemini text-embedding-004 dimension
--   metadata     JSONB,
--   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding ON vector_chunks USING ivfflat (embedding vector_cosine_ops);
-- CREATE INDEX IF NOT EXISTS idx_vector_chunks_org ON vector_chunks(org_id, source_type);
--
-- RAG ingestion: POST /api/copilot/ingest (planned v19)
-- RAG retrieval: integrated into context assembly in copilot.routes.ts
-- pgvector docs: https://github.com/pgvector/pgvector
