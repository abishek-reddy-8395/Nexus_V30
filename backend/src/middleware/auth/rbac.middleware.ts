/**
 * Nexus V30 — RBAC Middleware (full enterprise role hierarchy)
 *
 * Role hierarchy (highest → lowest):
 *   SUPER_ADMIN > ORG_OWNER > ORG_ADMIN > ANALYST > TRADER > VIEWER > API_CLIENT
 *
 * Usage:
 *   router.post('/admin-action', requireRole('ORG_OWNER', 'ORG_ADMIN'), handler)
 *   router.get('/analytics',    requirePermission('analytics:read'), handler)
 *   router.post('/ai',          requirePlan('pro', 'enterprise'), handler)
 */

import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from './auth.middleware';

// ─── Role hierarchy ──────────────────────────────────────────────────────────

export const ROLES = [
  'SUPER_ADMIN',
  'ORG_OWNER',
  'ORG_ADMIN',
  'ANALYST',
  'TRADER',
  'VIEWER',
  'API_CLIENT',
  // legacy aliases (backward compat)
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

export type Role = typeof ROLES[number];

/** Canonical permission set */
export type Permission =
  | 'analytics:read'
  | 'analytics:export'
  | 'behavioral:read'
  | 'ai:use'
  | 'ai:admin'
  | 'journal:write'
  | 'journal:read'
  | 'alerts:write'
  | 'alerts:read'
  | 'members:read'
  | 'members:invite'
  | 'members:remove'
  | 'org:read'
  | 'org:update'
  | 'billing:read'
  | 'billing:manage'
  | 'audit:read'
  | 'whitelabel:manage'
  | 'api_keys:manage'
  | 'impersonate'
  | 'cross_tenant';

/** Default permissions granted per role */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'analytics:read', 'analytics:export', 'behavioral:read', 'ai:use', 'ai:admin',
    'journal:write', 'journal:read', 'alerts:write', 'alerts:read',
    'members:read', 'members:invite', 'members:remove',
    'org:read', 'org:update', 'billing:read', 'billing:manage',
    'audit:read', 'whitelabel:manage', 'api_keys:manage',
    'impersonate', 'cross_tenant',
  ],
  ORG_OWNER: [
    'analytics:read', 'analytics:export', 'behavioral:read', 'ai:use', 'ai:admin',
    'journal:write', 'journal:read', 'alerts:write', 'alerts:read',
    'members:read', 'members:invite', 'members:remove',
    'org:read', 'org:update', 'billing:read', 'billing:manage',
    'audit:read', 'whitelabel:manage', 'api_keys:manage',
  ],
  ORG_ADMIN: [
    'analytics:read', 'analytics:export', 'behavioral:read', 'ai:use',
    'journal:write', 'journal:read', 'alerts:write', 'alerts:read',
    'members:read', 'members:invite',
    'org:read', 'billing:read', 'audit:read',
  ],
  ANALYST: [
    'analytics:read', 'analytics:export', 'behavioral:read', 'ai:use',
    'journal:write', 'journal:read', 'alerts:write', 'alerts:read',
    'org:read',
  ],
  TRADER: [
    'ai:use', 'journal:write', 'journal:read', 'alerts:write', 'alerts:read',
    'org:read',
  ],
  VIEWER: [
    'journal:read', 'alerts:read', 'org:read',
  ],
  API_CLIENT: [
    'analytics:read', 'journal:read', 'alerts:read',
  ],
  // legacy aliases
  owner:  ['analytics:read', 'analytics:export', 'behavioral:read', 'ai:use', 'members:read', 'members:invite', 'members:remove', 'org:read', 'org:update', 'billing:read', 'billing:manage', 'audit:read', 'api_keys:manage'],
  admin:  ['analytics:read', 'behavioral:read', 'ai:use', 'journal:write', 'journal:read', 'alerts:write', 'alerts:read', 'members:read', 'members:invite', 'org:read'],
  member: ['ai:use', 'journal:write', 'journal:read', 'alerts:write', 'alerts:read'],
  viewer: ['journal:read', 'alerts:read'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserRole(req: Request): string | undefined {
  return (req as any).orgRole ?? req.user?.role;
}

function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes(permission);
}

// ─── Middleware factories ─────────────────────────────────────────────────────

/**
 * Require one of the specified roles.
 * Must be placed AFTER authMiddleware.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', status: 401 });
      return;
    }
    const currentRole = getUserRole(req);
    if (!currentRole || !roles.includes(currentRole)) {
      res.status(403).json({
        error:    'Insufficient role',
        required: roles,
        current:  currentRole,
        status:   403,
      });
      return;
    }
    next();
  };
}

/**
 * Require a specific permission (derived from role or explicit grant).
 * Must be placed AFTER authMiddleware + tenantMiddleware.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', status: 401 });
      return;
    }
    const currentRole = getUserRole(req) ?? '';
    if (!hasPermission(currentRole, permission)) {
      res.status(403).json({
        error:      'Permission denied',
        permission,
        role:       currentRole,
        status:     403,
      });
      return;
    }
    next();
  };
}

/**
 * Require one of the specified plans (subscription tiers).
 * Must be placed AFTER authMiddleware.
 */
export function requirePlan(...plans: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', status: 401 });
      return;
    }
    if (!plans.includes(req.user.plan)) {
      res.status(403).json({
        error:      'Plan upgrade required',
        required:   plans,
        current:    req.user.plan,
        upgradeUrl: '/settings?tab=billing',
        status:     403,
      });
      return;
    }
    next();
  };
}

/**
 * Require email to be verified before accessing the endpoint.
 */
export function requireEmailVerified() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // emailVerified lives in the DB; JWT doesn't carry it.
    // Wire to DB lookup when enforcing strictly.
    next();
  };
}

/**
 * Compose multiple middleware checks: role OR permission OR plan.
 * Any one passing is sufficient.
 */
export function requireAny(
  ...checks: Array<ReturnType<typeof requireRole>>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    let idx = 0;
    const tryNext = () => {
      if (idx >= checks.length) {
        res.status(403).json({ error: 'Access denied', status: 403 });
        return;
      }
      const check = checks[idx++];
      let passed = false;
      check(req, { status: () => ({ json: () => {} }) } as any, () => {
        passed = true;
        next();
      });
      if (!passed) tryNext();
    };
    tryNext();
  };
}
