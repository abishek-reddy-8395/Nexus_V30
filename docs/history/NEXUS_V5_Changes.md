# Nexus V30 — Applied Fix Log

All fixes applied in this release, cross-referenced against the V4 Sanity Report and the comprehensive analysis observations.

---

## Security Fixes

### SEC-01 — JWT_SECRET centralised (was duplicated in 3 files)
- **File:** `backend/src/shared/constants/index.ts`
- **Change:** `JWT_SECRET` and `JWT_EXPIRES` exported from a single source
- **Impact:** `auth.service.ts`, `auth.middleware.ts`, `price-stream.gateway.ts` all import from constants. One change propagates everywhere.

### SEC-02 — Health endpoint no longer leaks version/uptime in production
- **File:** `backend/src/bootstrap/app.bootstrap.ts`
- **Change:** Production returns `{ status: 'ok' }` only. Dev returns full diagnostic info.

### SEC-04 — Rate limiter bypass decoupled from NODE_ENV
- **File:** `backend/src/bootstrap/app.bootstrap.ts`
- **Change:** `skip: () => process.env.NODE_ENV !== 'production'` → `skip: () => process.env.DISABLE_RATE_LIMITS === 'true'`
- **Impact:** Staging environments no longer silently bypass rate limits.

---

## Architecture Fixes

### ARCH-01 — Kafka consumers wired to WebSocket gateways
- **File:** `backend/src/bootstrap/websocket.bootstrap.ts`
- **Change:** `startSignalConsumer()` and `startAlertConsumer()` called at startup with gateway callbacks
- **Impact:** Signal and alert events now flow: Kafka → Consumer → Gateway → WebSocket client

### ARCH-02 — Alert consumer typed and wired
- **Files:** `backend/src/events/consumers/alert.consumer.ts`, `backend/src/websocket/gateways/alert.gateway.ts`
- **Change:** Consumer now calls `alertGateway.broadcast(event)` with typed `AlertTriggeredEvent`

---

## Database Layer (Major)

### DB-01 — Prisma schema added
- **File:** `backend/prisma/schema.prisma`
- **Tables:** `tenants`, `users`, `journal_entries`, `alerts`, `audit_log`
- **Note:** `candles` and `price_ticks` remain in TimescaleDB via raw SQL (see existing migrations)

### DB-02 — Prisma client singleton
- **File:** `backend/src/database/prisma/client.ts`
- **Change:** Dev hot-reload safe singleton with query logging in dev mode

### DB-03 — Auth repository migrated from in-memory Map to Prisma
- **File:** `backend/src/modules/auth/repositories/auth.repository.ts`
- **Change:** All reads/writes go through `prisma.user` + `prisma.tenant`. Graceful DB-unavailable fallback in dev.

### DB-04 — Journal service migrated from in-memory Map to Prisma
- **File:** `backend/src/modules/journal/services/journal.service.ts`
- **Change:** All CRUD goes through `prisma.journalEntry`. `computeStats()` remains a pure function (no DB call).

### DB-05 — Seed script updated for Prisma
- **File:** `backend/src/database/seed/run.ts`
- **Change:** Uses `prisma.user.upsert` + `prisma.journalEntry.createMany`. Demo credentials: `demo@nexus.local` / `nexus123`

### DB-06 — Backend package.json updated with Prisma
- **Change:** `@prisma/client` in dependencies, `prisma` in devDependencies. New scripts: `db:generate`, `db:push`, `db:studio`

---

## Frontend Fixes

### FE-01 — ErrorBoundary component added
- **File:** `apps/web/src/components/ErrorBoundary.tsx`
- **Change:** React class component catching render errors. Shows recovery UI instead of white screen.

### FE-02 — layout.tsx wraps app in ErrorBoundary
- **File:** `apps/web/src/app/layout.tsx`

### FE-03 — API client: token refresh + retry
- **File:** `apps/web/src/services/api.client.ts`
- **Change:** 401 interceptor attempts token refresh before logging out. Refresh lock prevents concurrent refresh calls. Both access and refresh tokens stored.

### FE-04 — New hooks: useJournal, useAlerts, usePortfolio, useAnalytics
- **File:** `apps/web/src/hooks/index.ts`
- **Change:** All data domains now have typed hooks. All hooks include `error` state (previously missing from several).

---

## Config & Developer Experience

### DX-01 — .env.example created
- **File:** `.env.example`
- **Change:** All 20 environment variables documented with descriptions and safe dummy values

### DX-02 — turbo.json: complete globalEnv list
- **File:** `turbo.json`
- **Change:** Added `TIMESCALEDB_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `AI_ENABLED`, `KAFKA_ENABLED`, `DISABLE_RATE_LIMITS`, `NEXT_PUBLIC_*`

### DX-03 — README rewritten with quick-start guide
- **File:** `README.md`
- **Change:** Step-by-step local dev setup, architecture diagram, production checklist

---

## Tests (First Coverage)

### TEST-01 — Auth smoke tests
- **File:** `backend/src/__tests__/auth.test.ts`
- **Coverage:** JWT sign/verify, expiry, tampering, secret length enforcement

### TEST-02 — Journal service unit tests
- **File:** `backend/src/__tests__/journal.service.test.ts`
- **Coverage:** `computeStats()` — empty state, win rate, profit factor, streak calculation

### TEST-03 — Engine service smoke tests
- **File:** `backend/src/__tests__/engine.service.test.ts`
- **Coverage:** Insufficient candles rejection (422), invalid symbol handling

### TEST-04 — Jest config
- **File:** `backend/jest.config.ts`

---

## What Was Already Fixed in v4 (Verified Unchanged)

All 8 bugs from the V4 Sanity Report remain fixed:
- BUG-01: Worker BullMQ import paths ✓
- BUG-02: Journal service event import depth ✓
- BUG-03: AI layer Logger import depth ✓
- BUG-04: apps/web/tsconfig.json exists ✓
- BUG-05: packages/utils, charts, contracts have package.json ✓
- BUG-06: execution-engine no longer imports RiskEngine directly ✓
- BUG-07: store.ts shared-types import path ✓
- BUG-08: loggingMiddleware wired in production ✓

---

## Remaining Known Gaps (Future Work)

These are architectural completeness items, not bugs:

| Gap | Priority | Notes |
|---|---|---|
| WebSocket state in Zustand store | P1 | Add `useWsStore` for real-time price/signal binding |
| TanStack Query for server state | P1 | Replace manual `useEffect` fetching in hooks |
| packages/ui component library | P1 | Button, Input, Badge, Card, Modal, DataTable |
| Token blacklist on logout (Redis) | P1 | Prevents reuse of logged-out JWTs |
| Replay/backtesting engine | P2 | `engines/replay-engine/` is empty |
| Portfolio routes → DB-backed | P2 | Currently in-memory Map |
| RBAC enforcement in routes | P2 | Plan/role checks needed beyond auth |
| OpenTelemetry full integration | P2 | Tracer exists, not wired to all routes |
| Helm charts for K8s | P3 | K8s YAML exists, Helm not started |
| CI/CD pipeline secrets | P3 | GitHub Actions workflow needs secrets wired |
