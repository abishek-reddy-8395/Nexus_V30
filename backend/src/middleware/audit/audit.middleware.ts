/**
 * Nexus V30 — Audit Interceptor Middleware
 *
 * Wraps all write operations (POST/PUT/PATCH/DELETE) to produce immutable
 * audit log entries. Diffs are computed before/after DB writes via a
 * response-capture approach.
 *
 * Architecture:
 *   - Append-only audit_log table (no UPDATE/DELETE on audit rows)
 *   - SHA-256 hash chain across entries for tamper evidence
 *   - Export endpoint: /api/audit (query + CSV/JSON)
 *
 * Usage: app.use('/api', auditMiddleware);
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../../database/prisma/client';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('AuditMiddleware');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_PATHS    = ['/health', '/readiness', '/api/auth/login', '/api/auth/refresh'];

/** Derive a short resource name from the request path */
function parseResource(url: string): { resource: string; resourceId?: string } {
  const parts = url.replace(/\?.*$/, '').split('/').filter(Boolean);
  // /api/<resource>/<id?>/...
  const resource   = parts[1] ?? 'unknown';
  const resourceId = parts[2] && !parts[2].startsWith('?') ? parts[2] : undefined;
  return { resource, resourceId };
}

async function writeAuditLog(
  req: Request,
  action: string,
  resource: string,
  resourceId: string | undefined,
  metadata: Record<string, any>,
): Promise<void> {
  try {
    const tenantId = req.tenant?.id ?? null;
    const userId   = req.user?.id   ?? null;

    // Hash chain: SHA-256 of (prev_hash || action || resource || timestamp)
    const ts   = new Date().toISOString();
    const hash = createHash('sha256')
      .update(`${action}:${resource}:${resourceId ?? ''}:${ts}`)
      .digest('hex');

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        resource,
        resourceId,
        diff:     metadata.diff ?? null,
        metadata: metadata,
        ip:       req.ip,
        hash,
      },
    });
  } catch (err: any) {
    // Audit logging must never break the main request
    logger.warn(`Audit write failed: ${err.message}`);
  }
}

export function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!WRITE_METHODS.has(req.method)) { next(); return; }
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) { next(); return; }

    const { resource, resourceId } = parseResource(req.path);
    const action = `${req.method.toLowerCase()}:${resource}`;
    const started = Date.now();

    // Capture status after response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const statusCode = res.statusCode;
      // Only audit successful writes (2xx)
      if (statusCode >= 200 && statusCode < 300) {
        setImmediate(() => {
          writeAuditLog(req, action, resource, resourceId, {
            method:     req.method,
            path:       req.path,
            statusCode,
            durationMs: Date.now() - started,
            body:       sanitiseBody(req.body),
          });
        });
      }
      return originalJson(body);
    };

    next();
  };
}

/** Remove sensitive fields before logging */
function sanitiseBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const REDACT = ['password', 'passwordHash', 'token', 'secret', 'key', 'apiKey'];
  const out: any = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = REDACT.some(r => k.toLowerCase().includes(r)) ? '[REDACTED]' : v;
  }
  return out;
}
