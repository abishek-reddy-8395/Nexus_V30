/**
 * Nexus V30 — Audit Log Routes
 *
 * GET  /api/audit           — query audit log (filterable, paginated)
 * GET  /api/audit/export    — CSV or JSON export for compliance
 *
 * Required role: ORG_ADMIN or higher
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma/client';
import { requirePermission } from '../../middleware/auth/rbac.middleware';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

export function registerAuditRoutes(): Router {
  const r = Router();

  // GET /api/audit
  r.get('/', requirePermission('audit:read'), wrap(async (req: Request, res: Response) => {
    const {
      resource, actor, from, to,
      page = '1', limit = '50',
    } = req.query as Record<string, string>;

    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (parseInt(page) - 1) * take;

    const where: any = {
      tenantId: req.tenant!.id,
      ...(resource && { resource }),
      ...(actor    && { userId: actor }),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true, action: true, resource: true, resourceId: true,
          userId: true, ip: true, metadata: true, createdAt: true, hash: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / take) });
  }));

  // GET /api/audit/export?format=csv|json
  r.get('/export', requirePermission('audit:read'), wrap(async (req: Request, res: Response) => {
    const { format = 'json', from, to } = req.query as Record<string, string>;

    const where: any = {
      tenantId: req.tenant!.id,
      ...(from || to ? { createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      }} : {}),
    };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 10_000,
      select: {
        id: true, action: true, resource: true, resourceId: true,
        userId: true, ip: true, createdAt: true, hash: true,
      },
    });

    if (format === 'csv') {
      const header = 'id,action,resource,resourceId,userId,ip,createdAt,hash\n';
      const rows   = logs.map(l =>
        [l.id, l.action, l.resource, l.resourceId ?? '', l.userId ?? '', l.ip ?? '', l.createdAt.toISOString(), l.hash ?? '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
      res.send(header + rows);
    } else {
      res.json({ logs, exported: logs.length, exportedAt: new Date().toISOString() });
    }
  }));

  return r;
}
