/**
 * Nexus V30 — Rate Limiter Factory
 * Re-exports the three standard limiters used across the API.
 *
 * Tier 1 — Auth:   20 req / 15 min   (brute-force protection)
 * Tier 2 — API:   200 req / min      (standard endpoints)
 * Tier 3 — Heavy:  30 req / min      (engine, AI, scanner — compute-heavy)
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request } from 'express';

function make(windowMs: number, max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator: (req: Request & { user?: { id: string }; tenant?: { id: string } }) =>
      req.user?.id ?? req.tenant?.id ?? req.ip ?? 'unknown',
    skip: () => process.env.DISABLE_RATE_LIMITS === 'true',
    message: { error: 'Rate limit exceeded — please slow down', status: 429 },
  });
}

export const rateLimiter = {
  authLimiter:  make(15 * 60 * 1000, 20),
  apiLimiter:   make(60 * 1000,      200),
  heavyLimiter: make(60 * 1000,      30),
};
