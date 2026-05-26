# Nexus V30 — Architectural Rules & Dependency Governance

> These rules are NON-NEGOTIABLE. They are what separates a folder structure
> from a real architecture. Violations compound. One bad import today becomes
> an untestable monolith in six months.

---

## 1. Allowed Dependency Graph

```
frontend (apps/)
    │  fetch / subscribe only
    ▼
packages/sdk           ← only entry point for all backend calls
    │
    ▼
backend/api/rest       ← HTTP surface — thin handlers only
    │
    ▼
backend/modules/       ← domain logic, orchestration
    │
    ▼
backend/engines/       ← SMC computation — pure functions
    │  emit events only
    ▼
backend/events/        ← Kafka producers
    │
    ▼
backend/workers/       ← consumers, side effects
```

## 2. Absolute Prohibitions

| Rule | Violation |
|------|-----------|
| Frontend NEVER imports from `backend/` | Any `import` crossing the app boundary |
| Engines NEVER import from modules | `engines/signal-engine` importing `modules/journal` |
| Engines NEVER call each other directly | `signal-engine` calling `confluence-engine` internals |
| AI layer NEVER triggers execution | `ai/` calling `execution-engine` directly |
| WebSocket logic NEVER leaks into routes | Business logic inside `api/rest/` handlers |
| API keys NEVER in client bundle | Any env var without `NEXT_PUBLIC_` prefix going to frontend |
| Raw engine output NEVER sent to client | `EngineService` must call `_sanitise()` before `res.json()` |

## 3. Engine Isolation Contract

Each engine exposes exactly ONE public interface:

```typescript
// ✅ CORRECT — engines communicate via typed contracts
interface LiquidityResult { bslSweep: boolean; score: number; ... }

// ✅ CORRECT — confluence-engine consumes contracts, not internals
class ConfluenceEngine {
  score(input: { liquidity: LiquidityResult; ... }): ConfluenceScore
}

// ❌ WRONG — importing engine internals
import { _detectSweep } from '../liquidity/sweep-detector'; // FORBIDDEN
```

Engine communication path:
```
EngineOrchestrator
  → run each engine independently
  → pass typed result objects between them
  → never pass engine instances to each other
```

## 4. Frontend Purity Contract

`apps/web/src/` is allowed to contain ONLY:

```
✅  fetch()  — via @nexus-v30/sdk only
✅  render() — React components, JSX
✅  subscribe() — WebSocket subscriptions via @nexus-v30/sdk
✅  UI state — Zustand stores (display state only)
✅  Formatting — price display, date format, color mapping
✅  Navigation — Next.js routing
```

`apps/web/src/` is FORBIDDEN from containing:

```
❌  SMC logic — structure, BOS, CHoCH detection
❌  Signal generation — bias, conviction calculation
❌  Risk math — pip values, lot sizes, position sizing
❌  AI prompts — prompt construction, model calls
❌  Market data fetching — direct Binance/Yahoo calls
❌  API keys — any secret credential
❌  Business rules — "signal is valid if confluence > 65"
```

## 5. Module Boundaries

Each module under `backend/src/modules/` owns its data completely:

```
modules/journal/
  controllers/  ← HTTP in, response out — NO business logic
  services/     ← ALL domain logic lives here
  repositories/ ← data access ONLY — no business logic
  dto/          ← input shapes (Zod-validated)
  validators/   ← domain-specific validation rules
  events/       ← Kafka event emit/consume for this domain
  tests/        ← unit + integration tests
```

Modules communicate via:
- **Events** (Kafka) for async cross-domain communication
- **Service interfaces** (injected) for sync cross-domain calls
- **Never** via direct `import` of another module's internals

## 6. AI Isolation Contract

```
✅  AI DOES:
    analyze market context
    generate narratives
    rank opportunities
    explain reasoning
    summarize signals

❌  AI NEVER:
    places orders
    modifies risk parameters
    accesses user account balances
    calls execution-engine directly
    reads raw engine internals
```

The AI layer receives **sanitised** engine outputs — the same objects sent to the frontend. It never sees internal engine state.

## 7. WebSocket Governance

```
✅  WS gateways:
    receive subscriptions
    broadcast server-pushed data
    enforce JWT auth per connection

❌  WS gateways NEVER:
    run SMC analysis
    call AI models
    calculate risk
    write to database
```

WS is a delivery channel — not a computation layer.

## 8. Contract-First Development

All cross-boundary communication MUST have a typed contract before implementation:

```
packages/contracts/zod/      ← input validation (Zod schemas)
packages/contracts/openapi/  ← REST API surface (OpenAPI 3.1)
packages/contracts/protobuf/ ← event bus messages (Protobuf)
packages/shared-types/       ← TypeScript types shared between apps
```

**Rule**: If a contract doesn't exist yet, CREATE IT before writing the implementation.

## 9. Sanitisation Boundary

The `EngineService` is the ONLY place that converts raw engine output to client-safe data:

```typescript
// backend/src/modules/market/engine.service.ts

private _sanitise(raw: EngineOutput): SanitisedEngineResult {
  return {
    signal:     { bias: raw.signal.bias, conviction: raw.signal.conviction, ... },
    confluence: { total: raw.confluence.total, ... },
    // ❌ NEVER include: raw.signal._internalScore, raw.structure._swingArray, etc.
  };
}
```

Nothing from `engines/` reaches `api/rest/` without passing through this sanitiser.

## 10. Enforcement Checklist

Before every PR merge, verify:

- [ ] No `apps/` file imports from `backend/`
- [ ] No engine imports another engine's internal file
- [ ] All route handlers delegate immediately to a service
- [ ] No API keys appear in `apps/web/` files
- [ ] Engine output passes through `_sanitise()` before `res.json()`
- [ ] New cross-domain communication has a Kafka event or typed contract
- [ ] AI layer has no path to execution engine
- [ ] WebSocket gateways contain zero business logic

---

## Maturity Ladder

| Level | What it means |
|-------|---------------|
| **L1** | Folders exist ✅ (achieved) |
| **L2** | Files in right folders ✅ (achieved) |
| **L3** | Dependency rules enforced ← **we are here** |
| **L4** | Contracts typed and validated |
| **L5** | Event-driven cross-module communication |
| **L6** | Engines fully tested in isolation |
| **L7** | Observable, deployable, scalable |

The jump from L2 to L3 is where most systems fail.
Structure without discipline is just organised chaos.
