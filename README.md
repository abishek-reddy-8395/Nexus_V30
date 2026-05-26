# Nexus V30 — Enterprise AI Trader Intelligence Infrastructure

Enterprise-grade AI trader intelligence platform purpose-built for prop firms, exchanges, and brokerages. Not a signal platform. Not a TradingView clone. **AI-powered behavioral analytics and trader engagement infrastructure.**

## What Nexus Is

- **9-engine deterministic SMC pipeline** — Market Structure → Liquidity → Imbalance → Order Block → Session → Regime → Confluence → Signal → Risk
- **AI Copilot** — "ChatGPT for professional traders" — context-aware, session-aware, market-aware
- **Behavioral Intelligence** — Emotional trading detection, revenge trading identification, overtrading alerts
- **Executive Analytics** — Retention cohorts, engagement KPIs (DAU/WAU/MAU), AI-generated insights
- **Enterprise Multi-tenant SaaS** — Schema-per-tenant isolation, 7-role RBAC, full audit trail
- **White-label ready** — Custom domains, branding, per-org feature flags

## Architecture

```
apps/web/            → Next.js 14 frontend (pure render layer — dark enterprise UI)
backend/             → Express API + SMC engines + AI copilot + event workers
  engines/           → 9 deterministic SMC engines (individually testable)
  api/rest/          → 20 route files, 75 endpoints, full OpenAPI spec
  middleware/        → Auth, RBAC, tenant, audit, observability
  ai/                → Narrative engine, prompt orchestration, model routing
  workers/           → Signal, alert, candle BullMQ workers
  websocket/         → 4 real-time gateways (price, signal, scanner, alert)
packages/
  shared-types/      → Engine, API, WebSocket, AI TypeScript contracts
  contracts/         → OpenAPI spec (nexus-api.yaml), Zod schemas
  sdk/               → Partner SDK
  design-system/     → Design tokens
infrastructure/
  kubernetes/        → K8s manifests (deployments, HPA, PDB, ingress, network policies)
  helm/nexus/        → Production Helm chart
  terraform/         → EKS infrastructure as code
  gitops/argocd/     → GitOps CD pipeline (staging + production)
  monitoring/        → Prometheus, Grafana dashboards, Loki, alerting rules
  vault/             → HashiCorp Vault integration for secrets
  service-mesh/      → Istio service mesh policy
```

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker + Docker Compose

### 1. Environment setup
```bash
cp .env.example .env
# Required: JWT_SECRET (min 32 chars), DATABASE_URL, REDIS_URL
# Optional: GEMINI_API_KEY or OPENAI_API_KEY (for AI features)
# Optional: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM (for email)
```

### 2. Start infrastructure
```bash
docker-compose up postgres redis -d
# Full event pipeline (optional):
docker-compose up kafka zookeeper -d
```

### 3. Database setup
```bash
pnpm install
cd backend
pnpm db:generate   # generate Prisma client
pnpm db:migrate    # run all 4 migrations (creates all tables)
pnpm db:seed       # seed demo data (optional)
```

### 4. Start development servers
```bash
pnpm dev   # starts backend (port 3001) + frontend (port 3000) via Turborepo
```

### 5. Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api-docs (OpenAPI)
- Health: http://localhost:3001/health
- WebSocket: ws://localhost:3001/ws

## Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Min 32 chars. Rotate before any deployment. |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis for cache, BullMQ, token blacklist |
| `GEMINI_API_KEY` | Recommended | Gemini Pro for AI Copilot and narratives |
| `OPENAI_API_KEY` | Optional | OpenAI fallback for AI features |
| `KAFKA_BROKERS` | Optional | Kafka for event streaming (graceful no-op fallback) |
| `SMTP_HOST` | Optional | SMTP server (SendGrid/Resend/Postmark/SES) |
| `SMTP_USER` | Optional | SMTP username or API key user |
| `SMTP_PASS` | Optional | SMTP password or API key |
| `SMTP_FROM` | Optional | From address (e.g. noreply@nexus.app) |
| `FRONTEND_ORIGIN` | Optional | Base URL for email links (default: http://localhost:3000) |
| `STRIPE_SECRET_KEY` | Optional | Stripe for billing |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook verification |
| `STRIPE_STARTER_PRICE_ID` | Optional | Stripe price ID for Starter plan ($299/mo) |
| `STRIPE_GROWTH_PRICE_ID` | Optional | Stripe price ID for Growth plan ($999/mo) |
| `STRIPE_ENTERPRISE_PRICE_ID` | Optional | Stripe price ID for Enterprise plan ($3,500+/mo) |
| `TIMESCALEDB_URL` | Optional | TimescaleDB for analytics time-series |
| `DISABLE_RATE_LIMITS` | Dev only | Set `true` in dev, never in prod |

## Engine Pipeline

```
Candles → StructureEngine → LiquidityEngine → ImbalanceEngine
       → OrderBlockEngine → BreakerBlockEngine → MitigationEngine
       → SessionEngine → RegimeEngine → ConfluenceEngine
       → SignalEngine → AIReasoningEngine → _sanitise() → Client
```

All engine internals are sanitised before the REST layer. The frontend never receives raw scoring weights, internal algorithms, or proprietary engine state.

## AI Features

- **AI Copilot** (`/api/copilot/*`) — Intent classification → context assembly → prompt construction → model routing → SSE streaming
- **War Room** (`/api/ai/war-room`) — Macro, liquidity, flow, sentiment, forecast analysis modes
- **Behavioral Coaching** — Real-time intervention on emotional trading, revenge trading, overtrading
- **Journal Insights** — AI sentiment analysis on trade notes
- **Session Debrief** — End-of-session AI performance narrative

## Billing Tiers

| Plan | Price | Seats | Key Features |
|---|---|---|---|
| Starter | $299/mo | 5 | AI Copilot (100 calls/mo), basic analytics |
| Growth | $999/mo | 25 | Full behavioral analytics, 1000 AI calls/mo |
| Enterprise | $3,500+/mo | Unlimited | White-label, full behavioral intelligence, dedicated CSM |
| White-Label | $15k setup + $2,500/mo/partner | Unlimited | Zero Nexus branding, custom domain, SLA 99.99% |

## Production Checklist

- [ ] `JWT_SECRET` set to cryptographically random 32+ char string
- [ ] `NODE_ENV=production`
- [ ] `DISABLE_RATE_LIMITS` not set
- [ ] PostgreSQL with TLS, Redis with password
- [ ] K8s secrets or Vault (never plaintext env in containers)
- [ ] Stripe keys configured for billing
- [ ] SMTP configured for transactional email
- [ ] Prometheus + Grafana scraping `/metrics`
- [ ] ArgoCD GitOps pipeline connected to repository
- [ ] Gatekeeper policies enforced (no root containers, resource limits)

## Version History

| Version | Key Changes |
|---|---|
| v18.0 | Enterprise productization — RBAC, audit trail, AI Copilot, behavioral analytics, white-label, enterprise billing, dark UI |
| v17.0 | 9-engine SMC pipeline, K8s/Terraform/GitOps infra, event-driven architecture, OpenAPI contracts |
| v5.0 | Multi-tenant foundation, tenant middleware, rate limiting, observability |
| v4.0 | Engine determinism, replay engine, Zod validation |
