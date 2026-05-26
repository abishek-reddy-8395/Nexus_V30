/**
 * Nexus V30 — Tenant Middleware
 *
 * Extracts tenant context from the authenticated JWT and attaches it
 * to req.tenant. All multi-tenant data queries are scoped by tenantId
 * — this ensures row-level isolation without relying on application-layer
 * guards alone (Postgres RLS provides the second isolation layer).
 */

import { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  id:   string;
  plan: 'free' | 'pro' | 'enterprise';
}

declare global {
  namespace Express {
    interface Request { tenant?: TenantContext; }
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    // authMiddleware should always run first; this is a safety net
    res.status(401).json({ error: 'Unauthenticated', status: 401 });
    return;
  }

  req.tenant = {
    id:   req.user.tenantId,
    plan: req.user.plan,
  };

  next();
}
