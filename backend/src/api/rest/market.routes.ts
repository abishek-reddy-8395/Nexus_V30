/**
 * Nexus V30 — Market Routes (full implementation)
 * GET /api/market/price/:sym, /watchlist, /scanner, /instruments
 */
import { Router, Request, Response, NextFunction } from 'express';
import { MarketService } from '../../modules/market/market.service';
import { VALID_SYMBOLS, VALID_TIMEFRAMES } from '../../shared/constants/index';
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) => (fn as any)(req, res, next).catch(next);
const svc = new MarketService();
export function registerMarketRoutes(): Router {
  const r = Router();
  r.get('/instruments', (_req, res) => res.json({ instruments: VALID_SYMBOLS }));
  r.get('/watchlist',   wrap(async (_req: Request, res: Response) => { res.json(await svc.fetchWatchlistData()); }));
  r.get('/price/:sym',  wrap(async (req: Request, res: Response) => {
    const sym = req.params.sym.toUpperCase().replace('/', '');
    const tf  = parseInt(req.query.tf as string) || 15;
    if (!VALID_SYMBOLS.includes(sym as any))      { res.status(400).json({ error: `Unknown symbol: ${sym}`, valid: VALID_SYMBOLS }); return; }
    if (!VALID_TIMEFRAMES.includes(tf as any))    { res.status(400).json({ error: `Invalid timeframe: ${tf}`, valid: VALID_TIMEFRAMES }); return; }
    res.json(await svc.fetchPriceAndCandles(sym, tf));
  }));
  return r;
}
