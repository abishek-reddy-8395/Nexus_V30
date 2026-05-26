/**
 * Nexus V30 — Application Bootstrap
 *
 * Architecture guarantee: All business logic, SMC engine computations,
 * financial calculations, and AI inference happen on the server.
 * The frontend is a pure visual/render layer.
 *
 * v17 adds: AI Copilot, enterprise analytics, behavioral intelligence,
 * white-label routes, audit interceptor, full RBAC permission matrix.
 */

import express, { Application } from 'express';
import helmet    from 'helmet';
import cors      from 'cors';
import { json }  from 'express';
import rateLimit from 'express-rate-limit';

import { authMiddleware }          from '../middleware/auth/auth.middleware';
import { tenantMiddleware }        from '../middleware/tenant/tenant.middleware';
import { requirePlan }             from '../middleware/auth/rbac.middleware';
import { auditMiddleware }         from '../middleware/audit/audit.middleware';
import { observabilityMiddleware } from '../middleware/observability/observability.middleware';
import { loggingMiddleware }       from '../middleware/logging/logging.middleware';
import { errorHandler }            from '../shared/exceptions/error-handler';

// REST routes
import { registerAuthRoutes }         from '../api/rest/auth.routes';
import { registerUserRoutes }         from '../api/rest/users.routes';
import { registerOrganizationRoutes } from '../api/rest/organizations.routes';
import { registerMarketRoutes }       from '../api/rest/market.routes';
import { registerEngineRoutes }       from '../api/rest/engine.routes';
import { registerScannerRoutes }      from '../api/rest/scanner.routes';
import { registerRiskRoutes }         from '../api/rest/risk.routes';
import { registerSessionRoutes }      from '../api/rest/session.routes';
import { registerJournalRoutes }      from '../api/rest/journal.routes';
import { registerAiRoutes }           from '../api/rest/ai.routes';
import { registerCalendarRoutes }     from '../api/rest/calendar.routes';
import { registerPortfolioRoutes }    from '../api/rest/portfolio.routes';
import { registerExecutionRoutes }    from '../api/rest/execution.routes';
import { registerAnalyticsRoutes }    from '../api/rest/analytics.routes';
import { registerAlertRoutes }        from '../api/rest/alerts.routes';
import { registerBillingRoutes }      from '../api/rest/billing.routes';
import { registerSettingsRoutes }     from '../api/rest/settings.routes';
// v17 — new enterprise routes
import { registerCopilotRoutes }      from '../api/rest/copilot.routes';
import { registerBrokerRoutes } from '../api/rest/broker.routes';
import { registerWhitelabelRoutes }   from '../api/rest/whitelabel.routes';
import { registerAuditRoutes }        from '../api/rest/audit.routes';

// ── Rate limiter factory ──────────────────────────────────────────────────────
function makeRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator: (req: any) => req.user?.id ?? req.tenant?.id ?? req.ip ?? 'unknown',
    skip: () => process.env.DISABLE_RATE_LIMITS === 'true',
    message: { error: 'Rate limit exceeded — please slow down', status: 429 },
  });
}

const authLimiter   = makeRateLimiter(15 * 60 * 1000, 20);   // 20 req/15min (auth: per strategy doc)
const apiLimiter    = makeRateLimiter(60 * 1000,       200);  // 200 req/min
const heavyLimiter  = makeRateLimiter(60 * 1000,       30);   // 30 req/min
const copilotLimiter = makeRateLimiter(60 * 1000,      60);   // 60 req/min (rate-limited inside route too)

export async function createApp(): Promise<Application> {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        imgSrc:     ["'self'", 'data:'],
        fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
        frameSrc:   ["'none'"],
        objectSrc:  ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: process.env.NODE_ENV === 'production'
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  }));

  app.use(cors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  }));

  // ── Stripe webhook needs raw body before JSON parser ──────────────────────
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(json({ limit: '2mb' }));
  app.use(process.env.NODE_ENV === 'production' ? loggingMiddleware() : observabilityMiddleware());

  // ── Health & readiness ────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.json({ status: 'ok' });
      return;
    }
    res.json({ status: 'ok', ts: Date.now(), version: '30.0.0', uptime: process.uptime() });
  });
  app.get('/readiness', (_req, res) => res.json({ status: 'ready', ts: Date.now() }));

  // ── Public auth routes ────────────────────────────────────────────────────
  app.use('/api/auth', authLimiter, registerAuthRoutes());

  // ── All protected routes: JWT + tenant context + audit interceptor ────────
  app.use('/api', authMiddleware, tenantMiddleware);
  app.use('/api', auditMiddleware());   // Audit all write operations

  // ── Standard-load routes ──────────────────────────────────────────────────
  app.use('/api/users',         apiLimiter, registerUserRoutes());
  app.use('/api/organizations', apiLimiter, registerOrganizationRoutes());
  app.use('/api/market',        apiLimiter, registerMarketRoutes());
  app.use('/api/journal',       apiLimiter, registerJournalRoutes());
  app.use('/api/calendar',      apiLimiter, registerCalendarRoutes());
  app.use('/api/risk',          apiLimiter, registerRiskRoutes());
  app.use('/api/session',       apiLimiter, registerSessionRoutes());
  app.use('/api/portfolio',     apiLimiter, registerPortfolioRoutes());
  app.use('/api/analytics',     apiLimiter, registerAnalyticsRoutes());
  app.use('/api/alerts',        apiLimiter, registerAlertRoutes());
  app.use('/api/billing',       apiLimiter, registerBillingRoutes());
  app.use('/api/settings',      apiLimiter, registerSettingsRoutes());
  app.use('/api/audit',         apiLimiter, registerAuditRoutes());

  // ── Enterprise feature routes ─────────────────────────────────────────────
  // White-label: enterprise + white_label plans
  app.use('/api/broker',     apiLimiter, registerBrokerRoutes());
  app.use('/api/whitelabel', apiLimiter, requirePlan('enterprise', 'white_label'), registerWhitelabelRoutes());

  // ── Heavy compute routes with plan enforcement ────────────────────────────
  app.use('/api/engine',    heavyLimiter, registerEngineRoutes());
  app.use('/api/scanner',   heavyLimiter, registerScannerRoutes());
  app.use('/api/ai',        heavyLimiter, requirePlan('pro', 'enterprise', 'white_label'), registerAiRoutes());
  app.use('/api/execution', heavyLimiter, requirePlan('pro', 'enterprise', 'white_label'), registerExecutionRoutes());

  // ── AI Copilot: available from starter plan upward ────────────────────────
  app.use('/api/copilot', copilotLimiter, registerCopilotRoutes());

  // ── Central error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
