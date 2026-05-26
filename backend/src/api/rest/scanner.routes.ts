/**
 * Nexus V30 — Scanner Routes (full implementation)
 * GET /api/scanner/run, POST /api/scanner/custom, GET /api/scanner/watchlist, /symbols
 * All scanning is server-side — no engine logic in client.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { MarketService } from '../../modules/market/market.service';
import { EngineService } from '../../modules/market/engine.service';
import { VALID_SYMBOLS } from '../../shared/constants/index';
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) => (fn as any)(req, res, next).catch(next);
const market = new MarketService();
const engine = new EngineService();
export function registerScannerRoutes(): Router {
  const r = Router();
  r.get('/symbols', (_req, res) => res.json({ symbols: VALID_SYMBOLS }));
  r.get('/run', wrap(async (req: Request, res: Response) => {
    const profile = ['retail','institutional'].includes(req.query.profile as string)
      ? req.query.profile as 'retail'|'institutional'
      : 'retail';
    const tf   = parseInt(req.query.tf as string) || 15;
    const syms = req.query.syms ? (req.query.syms as string).split(',').map(s => s.trim().toUpperCase()).filter(s => VALID_SYMBOLS.includes(s as any)) : [...VALID_SYMBOLS];
    if (!syms.length) { res.status(400).json({ error: 'No valid symbols', valid: VALID_SYMBOLS }); return; }
    const raw = await Promise.allSettled(syms.map(sym => market.fetchPriceAndCandles(sym, tf)));
    const items = raw.map((r,i) => r.status === 'fulfilled' ? { sym: syms[i], tf, ...r.value } : null).filter(Boolean) as any[];
    const results = await engine.runScanAnalysis(items, profile);
    res.json({ results, scannedAt: Date.now(), tf, summary: { bull: results.filter(r => r.signal.bias==='BULL').length, bear: results.filter(r => r.signal.bias==='BEAR').length, neutral: results.filter(r => r.signal.bias==='NEUTRAL').length, failed: syms.length - results.length } });
  }));
  r.post('/custom', wrap(async (req: Request, res: Response) => {
    const { syms = [], tf = 15 } = req.body;
    const valid = syms.map((s: string) => s.toUpperCase()).filter((s: string) => VALID_SYMBOLS.includes(s as any));
    if (!valid.length) { res.status(400).json({ error: 'No valid symbols' }); return; }
    const raw = await Promise.allSettled(valid.map((sym: string) => market.fetchPriceAndCandles(sym, tf)));
    const items = raw.map((r: any,i: number) => r.status==='fulfilled' ? { sym: valid[i], tf, ...r.value } : null).filter(Boolean) as any[];
    res.json({ results: await engine.runScanAnalysis(items, profile), scannedAt: Date.now(), tf });
  }));
  r.get('/watchlist', wrap(async (_req: Request, res: Response) => {
    res.json({ snapshot: await market.fetchWatchlistData(), updatedAt: Date.now() });
  }));
  return r;
}
