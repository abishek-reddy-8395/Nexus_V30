/**
 * Nexus v23 — Portfolio Routes
 * CRIT-3 fix: all async handlers now wrapped with wrap() for proper error propagation.
 *
 * GET /api/portfolio/summary   — total PnL, win rate, best/worst, by-symbol breakdown
 * GET /api/portfolio/positions — open trades (result not yet set, proxy for live positions)
 * GET /api/portfolio/history   — equity curve (cumulative PnL series)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { JournalService } from '../../modules/journal/services/journal.service';

const journalService = new JournalService();

// Error-propagating wrapper — all async handlers must use this
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

export function registerPortfolioRoutes(): Router {
  const r = Router();

  r.get('/summary', wrap(async (req: Request, res: Response) => {
    const entries  = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const stats    = journalService.computeStats(entries);
    const bySymbol: Record<string, { trades: number; pnl: number }> = {};
    for (const e of entries) {
      if (!bySymbol[e.sym]) bySymbol[e.sym] = { trades: 0, pnl: 0 };
      bySymbol[e.sym].trades++;
      bySymbol[e.sym].pnl = parseFloat(((bySymbol[e.sym].pnl) + (e.pnl ?? 0)).toFixed(2));
    }
    res.json({ summary: stats, bySymbol, totalTrades: entries.length, ts: Date.now() });
  }));

  r.get('/positions', wrap(async (req: Request, res: Response) => {
    const entries = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const open    = entries.filter(e => !e.result).slice(0, 20);
    res.json({ positions: open, count: open.length });
  }));

  r.get('/history', wrap(async (req: Request, res: Response) => {
    const range   = (req.query.range as string) ?? '30d';
    const entries = await journalService.getEntries(req.user!.id, req.tenant!.id);

    // Filter by range
    const now    = Date.now();
    const days   = parseInt(range) || 30;
    const cutoff = range === 'all' ? 0 : now - days * 86_400_000;
    const filtered = entries
      .filter(e => e.result && e.pnl != null && new Date(e.ts ?? e.createdAt).getTime() >= cutoff)
      .reverse();

    let running = 0;
    const curve = filtered.map(e => {
      running += e.pnl ?? 0;
      return {
        ts:     e.ts ?? e.createdAt,
        pnl:    e.pnl,
        cumPnl: parseFloat(running.toFixed(2)),
        sym:    e.sym,
        result: e.result,
      };
    });
    res.json({ curve, range, totalPnl: parseFloat(running.toFixed(2)) });
  }));

  return r;
}
