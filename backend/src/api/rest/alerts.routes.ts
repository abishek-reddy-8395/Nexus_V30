/**
 * Nexus V30 — Alerts Routes (fully implemented)
 * GET  /api/alerts          — list user alerts
 * POST /api/alerts          — create alert
 * DELETE /api/alerts/:id    — remove alert
 */
import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

// In-memory store (same pattern as v2 — replace with Postgres repo in Phase 4)
const _store = new Map<string, any[]>();

function getUserAlerts(userId: string): any[] {
  return _store.get(userId) ?? [];
}

export function registerAlertRoutes(): Router {
  const r = Router();

  r.get('/', (req: Request, res: Response) => {
    const alerts = getUserAlerts(req.user!.id);
    res.json({ alerts, count: alerts.length });
  });

  r.post('/', wrap(async (req: Request, res: Response) => {
    const { sym, type, condition, label } = req.body;
    if (!sym)  { res.status(400).json({ error: 'sym is required' });  return; }
    if (!type) { res.status(400).json({ error: 'type is required' }); return; }
    const VALID_TYPES = ['price','signal','confluence'];
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }); return;
    }
    const alert = {
      id: randomUUID(), userId: req.user!.id, tenantId: req.tenant!.id,
      sym: sym.toUpperCase(), type, condition: condition ?? {}, label: label ?? '',
      active: true, triggered: false, triggeredAt: null, createdAt: new Date().toISOString(),
    };
    const list = getUserAlerts(req.user!.id);
    list.push(alert);
    _store.set(req.user!.id, list);
    res.status(201).json({ alert });
  }));

  r.delete('/:id', (req: Request, res: Response) => {
    const list    = getUserAlerts(req.user!.id);
    const filtered = list.filter(a => a.id !== req.params.id);
    if (filtered.length === list.length) {
      res.status(404).json({ error: 'Alert not found' }); return;
    }
    _store.set(req.user!.id, filtered);
    res.status(204).end();
  });

  return r;
}
