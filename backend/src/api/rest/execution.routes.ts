/**
 * Nexus V30 — Execution Routes (Prisma-backed)
 *
 * POST /api/execution/prepare      — validate + preview trade before sending
 * POST /api/execution/:id/confirm  — confirm a prepared execution
 * POST /api/execution/:id/cancel   — cancel a pending execution
 * GET  /api/execution/history      — user's execution history (persisted)
 *
 * All risk calculations run server-side via RiskEngine + ExecutionEngine.
 * Executions are persisted to PostgreSQL — survive server restarts.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { RiskEngine }      from '../../engines/risk-engine/index';
import { ExecutionEngine } from '../../engines/execution-engine/index';
import { prisma }          from '../../database/prisma/client';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const riskEngine      = new RiskEngine();
const executionEngine = new ExecutionEngine();

export function registerExecutionRoutes(): Router {
  const r = Router();

  // POST /api/execution/prepare
  r.post('/prepare', wrap(async (req: Request, res: Response) => {
    const { sym, dir, entry, sl, tp, lots, mode, confluence, sessionWeight, balance } = req.body;

    if (!sym || !dir || !entry || !sl) {
      res.status(400).json({ error: 'sym, dir, entry, sl are required' }); return;
    }
    if (!['BUY', 'SELL'].includes(dir)) {
      res.status(400).json({ error: "dir must be 'BUY' or 'SELL'" }); return;
    }

    const effectiveBalance = balance ?? 10_000;
    const effectiveLots    = lots ?? 0.01;

    const riskCalc    = riskEngine.calculate({ sym, balance: effectiveBalance, riskPct: 1, entry: +entry, sl: +sl, tp: tp ? +tp : undefined });
    const execPreview = riskEngine.execPreview({ sym, lots: effectiveLots, sl: +sl, price: +entry });
    const preview     = executionEngine.preview({
      sym, dir, lots: effectiveLots, sl: +sl, tp: tp ? +tp : 0, entry: +entry,
      mode:          mode ?? 'market',
      confluence:    confluence ?? 0,
      sessionWeight: sessionWeight ?? 1,
      userId:        req.user!.id,
      tenantId:      req.tenant!.id,
      riskDollar:    execPreview.riskDollar,
      rr:            riskCalc.rr,
    }, effectiveBalance);

    const execution = await (prisma as any).execution.create({
      data: {
        userId:   req.user!.id,
        tenantId: req.tenant!.id,
        sym:      sym.toUpperCase(),
        dir,
        entry:    +entry,
        sl:       +sl,
        tp:       tp ? +tp : null,
        lots:     effectiveLots,
        status:   'pending',
        riskCalc: riskCalc as any,
        preview:  preview  as any,
      },
    });

    res.status(201).json({ execution });
  }));

  // POST /api/execution/:id/confirm
  r.post('/:id/confirm', wrap(async (req: Request, res: Response) => {
    const exec = await (prisma as any).execution.findUnique({ where: { id: req.params.id } });
    if (!exec)                   { res.status(404).json({ error: 'Execution not found' }); return; }
    if (exec.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (exec.status !== 'pending') { res.status(409).json({ error: `Execution is already ${exec.status}` }); return; }
    if (exec.preview && !(exec.preview as any).valid) {
      res.status(422).json({ error: 'Execution failed validation', blockers: (exec.preview as any).blockers }); return;
    }

    const updated = await (prisma as any).execution.update({
      where: { id: req.params.id },
      data:  { status: 'confirmed', confirmedAt: new Date() },
    });

    res.json({ execution: updated, message: 'Execution confirmed (broker integration point)' });
  }));

  // POST /api/execution/:id/cancel
  r.post('/:id/cancel', wrap(async (req: Request, res: Response) => {
    const exec = await (prisma as any).execution.findUnique({ where: { id: req.params.id } });
    if (!exec)                   { res.status(404).json({ error: 'Execution not found' }); return; }
    if (exec.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (exec.status !== 'pending') { res.status(409).json({ error: `Cannot cancel — execution is already ${exec.status}` }); return; }

    const updated = await (prisma as any).execution.update({
      where: { id: req.params.id },
      data:  { status: 'cancelled', cancelledAt: new Date() },
    });

    res.json({ id: updated.id, status: updated.status });
  }));

  // GET /api/execution/history
  r.get('/history', wrap(async (req: Request, res: Response) => {
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);

    const [executions, total] = await Promise.all([
      (prisma as any).execution.findMany({
        where:   { userId: req.user!.id, tenantId: req.tenant!.id },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      (prisma as any).execution.count({ where: { userId: req.user!.id, tenantId: req.tenant!.id } }),
    ]);

    res.json({ executions, total, limit, offset });
  }));

  return r;
}
