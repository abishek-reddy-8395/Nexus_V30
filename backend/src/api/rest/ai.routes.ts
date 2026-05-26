/**
 * Nexus V30 — AI Routes
 * POST /api/ai/analyze, /api/ai/market-context, /api/ai/war-room
 * API keys are server-side env vars — never sent to client.
 */
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { NarrativeEngine } from '../../ai/narrative-engine/index';
import { ModelRouter } from '../../ai/model-routing/index';
import { PromptOrchestrator } from '../../ai/prompt-orchestration/index';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) => (fn as any)(req, res, next).catch(next);
const aiLimiter = rateLimit({ windowMs: 60*1000, max: 10, keyGenerator: (req:any) => req.user?.id ?? req.ip, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many AI requests' } });
const svc = new NarrativeEngine();
const router_model = new ModelRouter();
const orchestrator = new PromptOrchestrator();

export function registerAiRoutes(): Router {
  const r = Router();
  r.post('/analyze', aiLimiter, wrap(async (req: Request, res: Response) => {
    const { prompt, maxTokens } = req.body;
    if (!prompt) { res.status(400).json({ error: 'prompt required' }); return; }
    if (prompt.length > 8000) { res.status(400).json({ error: 'prompt too long' }); return; }
    res.json(await svc.analyzePrompt(prompt, maxTokens ?? 600));
  }));
  r.post('/market-context', aiLimiter, wrap(async (req: Request, res: Response) => {
    if (!req.body.price) { res.status(400).json({ error: 'price required' }); return; }
    res.json(await svc.generate({ instrument: req.body.instrument ?? 'XAUUSD', timeframe: req.body.timeframe ?? 15, price: +req.body.price, ...req.body }));
  }));
  r.post('/war-room', aiLimiter, wrap(async (req: Request, res: Response) => {
    const { mode, ...vars } = req.body;
    const map: any = { macro:'war_room_macro', liq:'war_room_liquidity', flow:'war_room_flow', sentiment:'war_room_sentiment', forecast:'war_room_forecast' };
    const key = map[mode] ?? 'market_narrative';
    const { system, user } = orchestrator.build(key, vars);
    const model = router_model.selectModel(req.user?.plan as any);
    const text  = await router_model.call(model, system, user);
    res.json({ text, model, mode });
  }));
  // GET /api/ai/stream/:sym — SSE streaming narrative
  r.get('/stream/:sym', wrap(async (req: Request, res: Response) => {
    const { NarrativeEngine } = await import('../../ai/narrative-engine/index');
    const engine = new NarrativeEngine();
    const { price, structure, session, regime, confluence } = req.query as any;

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const generator = engine.stream({
      instrument: req.params.sym,
      timeframe:  15,
      price:      parseFloat(price ?? '0'),
      structure, session, regime,
      confluence: parseFloat(confluence ?? '0'),
      plan: (req.user as any)?.plan ?? 'free',
    });

    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }));

  return r;
}
