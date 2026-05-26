# NEXUS v30.0.0 — Enterprise Productization Release

## Overview
v18 closes every commercial gap identified in the Enterprise Strategy Report.
The infrastructure was already production-grade. v18 makes it enterprise-sellable.

---

## Backend Changes

### Phase 1 — Enterprise Productization
- **Prisma schema**: Added 9 new tables — `organizations`, `org_memberships`, `org_settings`, `feature_flags`, `subscriptions`, `api_keys`, `invitations`, `behavioral_events`, `trader_sessions`
- **RBAC middleware** (`rbac.middleware.ts`): Full 7-role hierarchy — SUPER_ADMIN, ORG_OWNER, ORG_ADMIN, ANALYST, TRADER, VIEWER, API_CLIENT — with `requirePermission()` covering 20 named permissions
- **Audit middleware** (`audit.middleware.ts`): NEW — intercepts all write ops, SHA-256 hash chain, append-only audit trail
- **Audit routes** (`audit.routes.ts`): NEW — `/api/audit` query + `/api/audit/export` CSV/JSON
- **Migration SQL** (`004_enterprise_saas.sql`): NEW — DDL for all 9 tables

### Phase 2 — Enterprise Analytics
- **Analytics routes** (`analytics.routes.ts`): Added `/retention`, `/behavioral`, `/engagement`, `/insights` — all behind `requirePermission('analytics:read')`
- Behavioral detection: emotional trading (< 2min re-entry), revenge trading (conviction drift), overtrading (>10 trades/day)
- Retention cohorts: 7/30/60/90-day windows
- Engagement score: DAU/WAU/MAU + composite scoring

### Phase 3 — AI Copilot
- **Copilot routes** (`copilot.routes.ts`): NEW — `/chat`, `/stream`, `/session-debrief`, `/journal-insight`, `/behavioral-coaching`
- Intent classification: market_analysis | trade_review | journal_analysis | education | behavioral_coaching
- Context assembly: 30-day trader profile + journal history + org rules
- SSE streaming with Gemini Pro fallback chain
- **Prompt orchestration** (`prompt-orchestration/index.ts`): 7 new copilot prompt templates added

### Phase 4 — White-Label
- **White-label routes** (`whitelabel.routes.ts`): NEW — branding config CRUD, feature flag management, partner org listing
- 3-tier depth model: powered_by | co_branded | full_white_label
- Feature gates per org stored in Redis + DB

### Phase 7 — Security / Billing
- **Billing routes** (`billing.routes.ts`): Enterprise pricing ($299/$999/$3,500+), real DB writes on webhook, customer portal, metered usage reporting
- Stripe webhook now writes `Subscription` records and calls `userRepo.updatePlan()`

### App Bootstrap (`app.bootstrap.ts`)
- Audit middleware wired globally to `/api`
- Copilot routes: `/api/copilot` (starter plan+)
- White-label routes: `/api/whitelabel` (enterprise plan+)
- Audit routes: `/api/audit`
- Version bumped to 30.0.0

---

## Frontend Changes

### Phase 5 — Acquisition-Grade UX
- **Root layout** (`layout.tsx`): Full dark theme (#0A1628 navy), Inter font, enterprise scrollbars
- **AppShell** (`AppShell.tsx`): NEW — Bloomberg-inspired left nav rail with session badges, org plan badge, UTC clock, session status indicators
- **Dashboard** (`DashboardPage.tsx`): Complete rebuild — dark terminal aesthetic, AI narrative auto-load, color-coded confluence bars, enterprise KPI strip
- **AI Copilot** (`AiAssistantPage.tsx`): Complete rebuild — streaming SSE chat, intent badges, quick prompts, context-aware
- **Analytics** (`AnalyticsPage.tsx`): NEW — 4-tab executive dashboard: Retention Cohorts, Behavioral Signals, Engagement KPIs, AI Insights
- **Settings** (`SettingsPage.tsx`): Complete rebuild — 5-tab enterprise settings: Account, Billing (plan upgrade), Organization, Security, White-Label

### API Client (`api.client.ts`)
- Added: `nexusCopilot` — chat, sessionDebrief, journalInsight, behavioralCoaching
- Extended: `nexusAnalytics` — retention, behavioral, engagement, insights
- Added: `nexusWhitelabel` — config CRUD, feature flags
- Added: `nexusAudit` — list, export
- Extended: `nexusBilling` — portal

---

## What This Enables

| Capability | Status |
|---|---|
| Enterprise demo to prop firm | ✅ Ready |
| AI Copilot differentiation pitch | ✅ Ready |
| Behavioral analytics moat story | ✅ Ready |
| SOC2 audit trail requirement | ✅ Ready |
| White-label partner deployment | ✅ Ready |
| Enterprise billing via Stripe | ✅ Ready |
| Acquisition data room — tech | ✅ Ready |

---

## Next: v19 Targets
- ML churn prediction model (TimescaleDB → Python service)
- Mobile app (React Native — briefing + alerts)
- SOC2 Type I audit preparation
- OpenAPI SDK generation + developer portal
- Embedded widget iframe SDK
