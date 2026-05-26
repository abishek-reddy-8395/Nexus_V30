/**
 * Nexus V30 — Engine Routes
 * GET /api/engine/analyze/:sym?tf=15&mode=intraday&profile=retail|institutional
 * GET /api/engine/scan?syms=XAUUSD,BTCUSD&tf=15&profile=retail|institutional
 * GET /api/engine/symbols
 * GET /api/engine/timeframes
 *
 * Profile param controls analysis depth:
 *   retail       — SMC heuristics, default thresholds (existing behaviour)
 *   institutional — Higher confluence gates, Sharpe proxies, MTF confirmation,
 *                   tighter R:R floors, statistical expectancy notes
 */
import { Router, Request, Response, NextFunction } from 'express';
import { MarketService }  from '../../modules/market/market.service';
import { EngineService }  from '../../modules/market/engine.service';
import { VALID_SYMBOLS, VALID_TIMEFRAMES, VALID_MODES } from '../../shared/constants/index';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const market = new MarketService();
const engine = new EngineService();

export const VALID_PROFILES = ['retail', 'institutional'] as const;
export type  AnalysisProfile = typeof VALID_PROFILES[number];

export function registerEngineRoutes(): Router {
  const r = Router();

  r.get('/symbols',    (_req, res) => res.json({ symbols: VALID_SYMBOLS }));
  r.get('/timeframes', (_req, res) => res.json({ timeframes: VALID_TIMEFRAMES }));
  r.get('/profiles',   (_req, res) => res.json({ profiles: VALID_PROFILES }));

  // GET /api/engine/analyze/:sym
  r.get('/analyze/:sym', wrap(async (req: Request, res: Response) => {
    const sym     = req.params.sym.toUpperCase().replace('/', '');
    const tf      = parseInt(req.query.tf as string) || 15;
    const mode    = (VALID_MODES as readonly string[]).includes(req.query.mode as string)
      ? req.query.mode as 'scalp' | 'intraday' | 'positional'
      : 'intraday';
    const profile = (VALID_PROFILES as readonly string[]).includes(req.query.profile as string)
      ? req.query.profile as AnalysisProfile
      : 'retail';

    if (!VALID_SYMBOLS.includes(sym as any)) {
      res.status(400).json({ error: `Unknown symbol: ${sym}`, valid: VALID_SYMBOLS }); return;
    }
    if (!VALID_TIMEFRAMES.includes(tf as any)) {
      res.status(400).json({ error: `Invalid timeframe: ${tf}`, valid: VALID_TIMEFRAMES }); return;
    }

    const marketData = await market.fetchPriceAndCandles(sym, tf);
    const analysis   = await engine.runAnalysis({
      sym, tf, mode, profile,
      candles:      marketData.candles,
      dailyCandles: marketData.dailyCandles,
      userId:       req.user!.id,
      tenantId:     req.tenant!.id,
    });

    res.json({ price: marketData.price, ...analysis });
  }));

  // GET /api/engine/scan
  r.get('/scan', wrap(async (req: Request, res: Response) => {
    const tf = parseInt(req.query.tf as string) || 15;
    const profile = (VALID_PROFILES as readonly string[]).includes(req.query.profile as string)
      ? req.query.profile as AnalysisProfile
      : 'retail';
    const syms = req.query.syms
      ? (req.query.syms as string).split(',').map(s => s.trim().toUpperCase()).filter(s => VALID_SYMBOLS.includes(s as any))
      : [...VALID_SYMBOLS];

    if (!syms.length) { res.status(400).json({ error: 'No valid symbols', valid: VALID_SYMBOLS }); return; }

    const raw = await Promise.allSettled(syms.map(sym => market.fetchPriceAndCandles(sym, tf)));
    const items = raw.map((r, i) => r.status === 'fulfilled' ? { sym: syms[i], tf, ...r.value } : null).filter(Boolean) as any[];
    const results = await engine.runScanAnalysis(items, profile);

    res.json({
      results, scannedAt: Date.now(), tf, profile,
      summary: {
        bull:    results.filter(r => r.signal.bias === 'BULL').length,
        bear:    results.filter(r => r.signal.bias === 'BEAR').length,
        neutral: results.filter(r => r.signal.bias === 'NEUTRAL').length,
        failed:  syms.length - results.length,
      },
    });
  }));

  return r;
}
