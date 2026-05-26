/**
 * Nexus V30 — Journal Routes (full implementation)
 * GET/POST/PATCH/DELETE /api/journal, GET /api/journal/stats
 */
import { Router, Request, Response, NextFunction } from 'express';
import { JournalService } from '../../modules/journal/services/journal.service';
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) => (fn as any)(req, res, next).catch(next);
const svc  = new JournalService();
export function registerJournalRoutes(): Router {
  const r = Router();
  r.get('/stats', wrap(async (req: Request, res: Response) => { res.json({ stats: await svc.getStats(req.user!.id, req.tenant!.id) }); }));
  r.get('/',      wrap(async (req: Request, res: Response) => { const e = await svc.getEntries(req.user!.id, req.tenant!.id); res.json({ entries: e, count: e.length }); }));
  r.post('/',     wrap(async (req: Request, res: Response) => {
    if (!req.body.sym)   { res.status(400).json({ error: 'sym is required' }); return; }
    if (!req.body.entry) { res.status(400).json({ error: 'entry price is required' }); return; }
    res.status(201).json({ entry: await svc.addEntry(req.user!.id, req.tenant!.id, req.body) });
  }));
  r.patch('/:id', wrap(async (req: Request, res: Response) => {
    const ALLOWED = ['result','pnl','notes','tags','tp1','sl'];
    const updates: any = {};
    for (const k of ALLOWED) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (!Object.keys(updates).length) { res.status(400).json({ error: 'No valid fields', allowed: ALLOWED }); return; }
    res.json({ entry: await svc.updateEntry(req.user!.id, req.params.id, updates) });
  }));
  r.delete('/:id', wrap(async (req: Request, res: Response) => { await svc.deleteEntry(req.user!.id, req.params.id); res.status(204).end(); }));
  return r;
}
