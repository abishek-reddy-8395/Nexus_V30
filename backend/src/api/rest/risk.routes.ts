/**
 * Nexus V30 — Risk Routes (full implementation)
 * POST /api/risk/calculate, /validate, /exec-preview
 * GET  /api/risk/instruments
 */
import { Router, Request, Response, NextFunction } from 'express';
import { RiskEngine, INSTRUMENTS } from '../../engines/risk-engine/index';
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) => (fn as any)(req, res, next).catch(next);
const engine = new RiskEngine();
export function registerRiskRoutes(): Router {
  const r = Router();
  r.get('/instruments', (_req, res) => res.json({ instruments: Object.entries(INSTRUMENTS).map(([sym, s]) => ({ sym, ...s })) }));
  r.post('/calculate', wrap(async (req: Request, res: Response) => {
    const { sym, balance, riskPct, entry, sl, tp } = req.body;
    if (!sym)                     { res.status(400).json({ error: 'sym is required' }); return; }
    if (!balance || balance <= 0) { res.status(400).json({ error: 'balance must be > 0' }); return; }
    if (!entry || !sl)            { res.status(400).json({ error: 'entry and sl are required' }); return; }
    res.json(engine.calculate({ sym, balance: +balance, riskPct: +(riskPct || 1), entry: +entry, sl: +sl, tp: tp ? +tp : undefined }));
  }));
  r.post('/validate',     wrap(async (req: Request, res: Response) => { res.json(engine.validate(req.body)); }));
  r.post('/exec-preview', wrap(async (req: Request, res: Response) => {
    const { sym, lots, sl, price } = req.body;
    if (!sym || !lots || !sl || !price) { res.status(400).json({ error: 'sym, lots, sl, price required' }); return; }
    res.json(engine.execPreview({ sym, lots: +lots, sl: +sl, price: +price }));
  }));
  return r;
}
