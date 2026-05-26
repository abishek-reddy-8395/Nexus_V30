# Nexus V30.0 — Architecture Document

## Executive Summary

Nexus V30.0 is a full-stack institutional trading intelligence platform built as
a **TypeScript monorepo** (Turborepo + pnpm workspaces). It extends the v2
backend-first architecture into a production-grade, multi-tenant SaaS system.

The core architectural guarantee is unchanged from v2:

> **Every piece of business logic, financial calculation, SMC engine computation,
> and AI inference runs exclusively on the server. The frontend is a pure visual
> render layer — it receives only sanitised data objects, never algorithms.**

---

## Monorepo Structure

```
nexus/
├── apps/
│   ├── web/           ← Next.js 14 SaaS web platform  (port 3000)
│   ├── admin/         ← Internal admin portal
│   ├── mobile/        ← React Native / Flutter
│   └── desktop/       ← Electron trading terminal
│
├── backend/           ← Express + TypeScript API server (port 3001)
│
├── packages/
│   ├── ui/            ← Shared React component library
│   ├── design-system/ ← Tokens, typography, colors, motion
│   ├── charts/        ← TradingView Lightweight Charts wrappers
│   ├── sdk/           ← REST + WS clients, generated types
│   ├── shared-types/  ← API contracts (sanitised, client-safe)
│   ├── contracts/     ← OpenAPI, Protobuf, Zod schemas
│   ├── config/        ← Shared ESLint, TypeScript configs
│   └── utils/         ← Pure utility functions
│
├── infrastructure/    ← Docker, Kubernetes, Terraform, monitoring
├── data/              ← Migrations, schemas, fixtures
├── docs/              ← Architecture, API, runbooks
└── tools/             ← Code generators, automation scripts
```

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────┐
│                    BROWSER / CLIENT                        │
│                                                            │
│  apps/web (Next.js 14)   apps/mobile   apps/desktop       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Visual Layer ONLY                                   │  │
│  │  • Render data received from API                     │  │
│  │  • Chart drawing (TradingView Lightweight)           │  │
│  │  • Canvas overlays (SMC zones, OBs, FVGs)           │  │
│  │  • Toast / audio notifications                       │  │
│  │  • Page routing (Next.js App Router)                 │  │
│  │  • React state (Zustand)                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│              packages/sdk (REST + WebSocket)                │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS / WSS
           ┌───────────────▼───────────────┐
           │      infrastructure/nginx      │
           │      (TLS termination)         │
           └───────────────┬───────────────┘
                           │
           ┌───────────────▼───────────────────────────┐
           │         backend/  (Express + TypeScript)   │
           │                                            │
           │  POST /api/auth/*   — JWT auth             │
           │  GET  /api/market/* — OHLCV data           │
           │  GET  /api/engine/* — SMC analysis ───────→ engines/
           │  GET  /api/scanner/*— Multi-sym scan       │
           │  POST /api/risk/*  — Position sizing       │
           │  GET  /api/session/*— Session/clock        │
           │  *    /api/journal/*— Trade journal        │
           │  POST /api/ai/*    — AI narratives ───────→ ai/
           │  GET  /api/calendar/*─ Economic events     │
           │  *    /api/portfolio/*─ Portfolio mgmt     │
           │  *    /api/execution/*─ Order execution    │
           │  *    /api/analytics/*─ Performance        │
           │  *    /api/alerts/*  ─ Alert rules         │
           │  *    /api/billing/* ─ Subscriptions       │
           │                                            │
           │  WebSocket channels:                       │
           │  /ws (prices, signals, scanner, alerts)    │
           └────────────────────────────────────────────┘
                     │            │           │
           ┌─────────┘    ┌───────┘   ┌──────┘
           ▼              ▼           ▼
      PostgreSQL      TimescaleDB   Redis
      (users, orgs,  (OHLCV time-  (cache,
       journal,       series,       sessions,
       billing)       candles)      rate limits)
                              │
                         Kafka (events)
                              │
                    BullMQ workers (background)
```

---

## v2 → v3 Migration: What Changed

| Concern          | v2                          | v3                              |
|------------------|-----------------------------|---------------------------------|
| Language         | JavaScript (Node.js)        | TypeScript strict mode          |
| Framework        | Express (single file)       | Express + modular bootstrap     |
| Database         | In-memory Maps              | PostgreSQL + TimescaleDB        |
| Cache            | node-cache                  | Redis                           |
| Message queue    | None                        | Kafka + BullMQ                  |
| Auth             | JWT (single tenant)         | JWT + multi-tenant (tenantId)   |
| Frontend         | Vanilla HTML/JS             | Next.js 14 (App Router)         |
| API client       | apiClient.js (window global)| @nexus-v30/sdk (TypeScript module)  |
| Type safety      | None (JSDoc comments)       | Full TypeScript end-to-end      |
| Monorepo         | Single folder               | Turborepo + pnpm workspaces     |
| Monitoring       | console.log                 | OpenTelemetry + Prometheus      |
| Deployment       | docker-compose              | Kubernetes + Terraform          |

## What Did NOT Change (Architectural Constants)

- **Engine isolation**: SMC engine (engines/) runs server-side only
- **API key isolation**: No Gemini/TwelveData/Binance keys in client bundle
- **Rate limiting**: 3-tier (auth / standard / heavy compute)
- **JWT auth**: All routes except `/api/auth/*` and `/health`
- **Sanitised outputs**: Frontend receives levels, scores, signals — never algorithms
- **WS auth**: JWT on first message before any subscription

---

## Backend Modules

Each module under `backend/src/modules/` follows the same structure:

```
modules/<name>/
├── controllers/     ← HTTP handlers (thin — delegate to service)
├── services/        ← Business logic (all computation here)
├── repositories/    ← Data access (PostgreSQL / Redis)
├── guards/          ← Auth + permission guards
├── dto/             ← Input validation schemas (Zod)
├── validators/      ← Custom validation logic
├── events/          ← Kafka event producers/consumers
└── tests/           ← Unit + integration tests
```

Modules: auth, users, organizations, tenants, billing, subscriptions,
permissions, analytics, notifications, alerts, market, execution,
portfolio, watchlist, ai, audit, settings.

---

## Engine Layer

```
backend/src/engines/
├── market-structure/   ← BOS, CHoCH, swing detection, trend
├── liquidity/          ← EQH/EQL, sweep detection
├── imbalance/          ← FVG identification and fill tracking
├── order-block/        ← OB detection, mitigation tracking
├── breaker-block/      ← Broken OBs (bearish/bullish breakers)
├── mitigation/         ← OB mitigation state machine
├── session-engine/     ← Trading session detection, killzones
├── confluence-engine/  ← Multi-factor scoring (0–100)
├── signal-engine/      ← Final signal generation (BULL/BEAR/WAIT)
├── risk-engine/        ← Position sizing, lot calculation
├── execution-engine/   ← Trade preparation and confirmation
├── regime-engine/      ← Market regime classification
├── replay-engine/      ← Backtest / replay mode
└── ai-reasoning/       ← LLM reasoning integration
```

All engine code runs **exclusively** on the backend. Output is sanitised
by `EngineService._sanitise()` before reaching any route handler.

---

## WebSocket Protocol

```
Client → Server:
  { "type": "auth",        "token": "<jwt>" }
  { "type": "subscribe",   "sym": "XAUUSD", "tf": 15 }
  { "type": "unsubscribe", "sym": "XAUUSD" }

Server → Client:
  { "type": "auth_ok",    "userId": "..." }
  { "type": "price",      "sym": "XAUUSD", "price": 2345.50, "ts": 1716000000000 }
  { "type": "candle",     "sym": "XAUUSD", "tf": 15, "candle": {...} }
  { "type": "signal",     "sym": "XAUUSD", "signal": { bias, conviction, ... } }
  { "type": "alert",      "alert": { id, title, sym, ... } }
  { "type": "error",      "message": "..." }
```

---

## Security Model

- **API key isolation**: Gemini, TwelveData, Binance keys are server-only env vars
- **Algorithm protection**: Engine source code never reaches client bundles
- **Rate limiting**: 3-tier at Express middleware level (auth/standard/heavy)
- **JWT authentication**: All protected routes, WS first message
- **Multi-tenancy**: tenantId in JWT payload; all DB queries scoped to tenant
- **Row-Level Security**: Postgres RLS as second isolation layer
- **HTTPS only**: TLS termination at nginx

---

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker

# Install all workspace dependencies
pnpm install

# Start infrastructure (postgres, redis, kafka)
docker-compose up postgres redis kafka -d

# Run migrations
pnpm db:migrate

# Start backend + frontend in parallel
pnpm dev

# Or start individually:
cd backend && pnpm dev          # → http://localhost:3001
cd apps/web && pnpm dev         # → http://localhost:3000

# Full stack with Docker
docker-compose up --build
```

---

## Remaining Tasks (Priority Order)

### P1 — Database Layer
Replace in-memory Maps with Prisma + PostgreSQL:
- `backend/src/database/migrations/` — run schema migrations
- Each module's `repositories/` — swap Map for Prisma client
- TimescaleDB — OHLCV candle storage with hypertable

### P2 — Engine Backport
Port the 2354-line v2 Engine.js to TypeScript engines/:
- `market-structure/` — StructureEngine
- `liquidity/`        — LiquidityEngine
- `order-block/`      — OrderBlockEngine
- `confluence-engine/`— ConfluenceEngine
- `signal-engine/`    — SignalEngine

### P3 — Next.js Pages
Wire up all pages in `apps/web/src/pages/`:
- dashboard, signals, execution, scanner, journal, ai-assistant, calendar

### P4 — Kafka Workers
Implement background workers in `backend/src/workers/`:
- `candles/`   — periodic OHLCV refresh → TimescaleDB
- `signals/`   — engine scan on schedule → Kafka → WS broadcast
- `alerts/`    — price/signal alert evaluation

### P5 — Kubernetes Deployment
- `infrastructure/kubernetes/` — production manifests
- `infrastructure/terraform/`  — cloud provisioning
