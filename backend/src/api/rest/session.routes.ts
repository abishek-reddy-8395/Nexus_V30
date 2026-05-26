/**
 * Nexus v23 — Session Routes
 * CRIT-3 fix: async handlers now wrapped with wrap() for proper error propagation.
 *
 * GET /api/session/current    — active session + killzone info
 * GET /api/session/badges     — session achievement badges
 * GET /api/session/clock      — UTC clock + session times
 * GET /api/session/orderbook  — simulated order book for a symbol/price
 * GET /api/session/emotional  — emotional trading score from journal
 * GET /api/session/risk-panel — combined session + performance stats
 */
import { Router, Request, Response, NextFunction } from 'express';
import { SessionEngine }  from '../../engines/session-engine/index';
import { JournalService } from '../../modules/journal/services/journal.service';

const engine     = new SessionEngine();
const journalSvc = new JournalService();

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

export function registerSessionRoutes(): Router {
  const r = Router();

  // Sync handlers — no wrap needed, cannot throw async
  r.get('/current',   (_req, res) => res.json(engine.getCurrent()));
  r.get('/badges',    (_req, res) => res.json({ badges: engine.getSessionBadges(), utcHour: new Date().getUTCHours() }));
  r.get('/clock',     (_req, res) => res.json(engine.getClock()));
  r.get('/orderbook', (req, res)  => {
    const sym   = ((req.query.sym as string) ?? 'XAUUSD').toUpperCase();
    const price = parseFloat(req.query.price as string) || 2345;
    res.json(engine.generateOrderBook(sym, price));
  });

  // Async handlers — CRIT-3 fix: wrapped
  r.get('/emotional', wrap(async (req: Request, res: Response) => {
    const entries = await journalSvc.getEntries(req.user!.id, req.tenant!.id);
    res.json({
      score:      engine.computeEmotionalScore(entries),
      sampleSize: Math.min(entries.length, 20),
    });
  }));

  r.get('/risk-panel', wrap(async (req: Request, res: Response) => {
    const session = engine.getCurrent();
    const entries = await journalSvc.getEntries(req.user!.id, req.tenant!.id);
    const stats   = journalSvc.computeStats(entries);
    res.json({ session, stats });
  }));

  return r;
}
