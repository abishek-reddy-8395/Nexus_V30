/**
 * Nexus V30 — AI Copilot Routes
 *
 * "ChatGPT for professional traders" — context-aware, session-aware, market-aware.
 *
 * POST /api/copilot/chat            — multi-turn copilot (JSON response)
 * GET  /api/copilot/stream          — SSE streaming copilot response
 * POST /api/copilot/session-debrief — end-of-session AI debrief
 * POST /api/copilot/journal-insight — journal sentiment + insight
 * POST /api/copilot/behavioral-coaching — intervention on detected signal
 *
 * Architecture (per strategy doc):
 *   1. INTENT CLASSIFICATION  — route to specialised prompt template
 *   2. CONTEXT ASSEMBLY       — market + session + trader memory + journal + org
 *   3. PROMPT CONSTRUCTION    — merge template + context + safety rails
 *   4. MODEL ROUTING          — Gemini Pro | Gemini Flash | local fallback
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../database/prisma/client';
import { ModelRouter } from '../../ai/model-routing/index';
import { Logger } from '../../shared/helpers/logger';
import { requirePlan } from '../../middleware/auth/rbac.middleware';

const logger      = new Logger('CopilotRoutes');
const modelRouter = new ModelRouter();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

// Copilot rate limit — 30 req/min per user
const copilotLimiter = rateLimit({
  windowMs:      60_000,
  max:           30,
  keyGenerator:  (req: any) => req.user?.id ?? req.ip,
  standardHeaders: true,
  legacyHeaders:   false,
  message:       { error: 'Copilot rate limit exceeded — please wait before sending another message' },
});

// ─── Intent classification ────────────────────────────────────────────────────

type Intent =
  | 'market_analysis'
  | 'trade_review'
  | 'journal_analysis'
  | 'education'
  | 'behavioral_coaching'
  | 'general';

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (/market|structure|liquidity|regime|session|bias|entry|level|zone|ob|fvg|bos|choch/.test(q))
    return 'market_analysis';
  if (/trade|position|review|pnl|loss|win|stop|tp|sl|r:r|rr/.test(q))
    return 'trade_review';
  if (/journal|pattern|emotional|revenge|overtrad|habit|psycholog/.test(q))
    return 'journal_analysis';
  if (/what is|explain|teach|how does|define|education|learn/.test(q))
    return 'education';
  if (/coaching|advice|help me|feeling|stressed|break|pause/.test(q))
    return 'behavioral_coaching';
  return 'general';
}

// ─── Context assembly ─────────────────────────────────────────────────────────

async function assembleContext(userId: string, tenantId: string, intent: Intent): Promise<string> {
  const parts: string[] = [];

  // Always include: trader profile from last 30 days
  const recentJournals = await prisma.journalEntry.findMany({
    where:   { userId, tenantId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select:  { result: true, pnl: true, sym: true, session: true, notes: true, ts: true, conviction: true },
  });

  const wins     = recentJournals.filter(j => j.result === 'win').length;
  const resolved = recentJournals.filter(j => j.result).length;
  const winRate  = resolved > 0 ? Math.round((wins / resolved) * 100) : 0;
  const syms     = [...new Set(recentJournals.map(j => j.sym))].slice(0, 5).join(', ');

  parts.push(`TRADER PROFILE (30-day):
  Win rate: ${winRate}% (${wins}W/${resolved - wins}L, ${resolved} trades)
  Instruments traded: ${syms || 'N/A'}
  Recent conviction avg: ${recentJournals.filter(j => j.conviction).reduce((s, j) => s + (j.conviction ?? 0), 0) / Math.max(recentJournals.filter(j => j.conviction).length, 1) | 0}/100`);

  // Journal context: last 10 entries
  if (['journal_analysis', 'behavioral_coaching', 'trade_review'].includes(intent)) {
    const last10 = recentJournals.slice(0, 10);
    if (last10.length > 0) {
      parts.push(`\nRECENT JOURNAL (last ${last10.length} entries):
${last10.map(j => `  ${new Date(j.ts).toISOString().slice(0, 10)} ${j.sym} ${j.result ?? 'open'} PnL:${j.pnl ?? '?'} conviction:${j.conviction ?? '?'}`).join('\n')}`);
    }
  }

  // Org rules (tenant-specific constraints)
  parts.push(`\nORG CONTEXT: tenantId=${tenantId}`);

  return parts.join('\n');
}

// ─── Prompt construction ──────────────────────────────────────────────────────

const SAFETY_RAIL = `
SAFETY RULES:
- Always frame output as "analysis" not "recommendation". Never give financial advice.
- Do not expose proprietary engine parameters or internal system details.
- If asked for specific financial advice, redirect to analysis framing.
- Include disclaimer: "This is analytical output, not financial advice."`;

function buildCopilotPrompt(
  query: string,
  intent: Intent,
  context: string,
  marketCtx?: string,
): { system: string; user: string } {
  const systemMap: Record<Intent, string> = {
    market_analysis:    'You are an institutional SMC trading analyst for NEXUS. Provide precise, actionable market analysis using SMC methodology. Reference specific price levels from context. Be concise and professional.',
    trade_review:       'You are an SMC trade review analyst. Evaluate trades objectively. Identify strengths and improvement areas. Use R:R, confluence score, and market conditions in your assessment.',
    journal_analysis:   'You are a trading psychology analyst. Analyze trading journal patterns for behavioral insights, emotional biases, and psychological patterns. Be constructive and evidence-based.',
    education:          'You are an SMC education specialist. Explain Smart Money Concepts clearly with examples. Adapt complexity to the query. Always ground examples in real market structure.',
    behavioral_coaching: 'You are a trading performance coach. Provide supportive, evidence-based coaching. Acknowledge emotions, provide actionable steps, reference the trader\'s own data.',
    general:            'You are an AI Trader Copilot for NEXUS. Help professional traders with market analysis, trade review, journaling, and performance coaching. Be precise and professional.',
  };

  const system = `${systemMap[intent]}\n${SAFETY_RAIL}`;

  const user = `INTENT: ${intent}

${context}
${marketCtx ? `\nMARKET CONTEXT:\n${marketCtx}` : ''}

TRADER QUERY: ${query}

Provide a helpful, context-aware response. Be specific to their data and situation. End with one actionable next step.`;

  return { system, user };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export function registerCopilotRoutes(): Router {
  const r = Router();

  /**
   * POST /api/copilot/chat
   * Full copilot conversation turn with intent classification + context assembly.
   */
  r.post('/chat', requirePlan('starter', 'growth', 'enterprise', 'white_label', 'pro'), copilotLimiter, wrap(async (req: Request, res: Response) => {
    const { query, marketContext, conversationHistory = [] } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    if (query.length > 2000) {
      res.status(400).json({ error: 'query too long (max 2000 chars)' });
      return;
    }

    const intent  = classifyIntent(query);
    const context = await assembleContext(req.user!.id, req.tenant!.id, intent);
    const { system, user } = buildCopilotPrompt(query, intent, context, marketContext);

    // Build message history for multi-turn
    const messages = [
      ...conversationHistory.slice(-10), // last 10 turns
      { role: 'user', content: user },
    ];

    try {
      const model = modelRouter.selectModel(req.user!.plan as any, 'default');
      const text  = await modelRouter.call(model, system, messages[messages.length - 1].content, 800);

      // Log AI interaction event (for analytics)
      logger.info(`Copilot query: user=${req.user!.id} intent=${intent} model=${model}`);

      res.json({
        response: text,
        intent,
        model,
        contextUsed:    ['trader_profile', 'journal_context', 'org_rules'],
        disclaimer:     'This is analytical output, not financial advice.',
        conversationId: req.body.conversationId ?? null,
      });
    } catch (err: any) {
      logger.error(`Copilot error: ${err.message}`);
      res.status(500).json({
        error:    'AI response failed',
        fallback: 'AI Copilot is temporarily unavailable. Please check your API key configuration.',
      });
    }
  }));

  /**
   * GET /api/copilot/stream?query=...&intent=...
   * SSE streaming copilot response (uses existing useSSEStream hook on frontend).
   */
  r.get('/stream', requirePlan('starter', 'growth', 'enterprise', 'white_label', 'pro'), copilotLimiter, wrap(async (req: Request, res: Response) => {
    const { query, marketContext } = req.query as Record<string, string>;
    if (!query) { res.status(400).json({ error: 'query required' }); return; }

    const intent  = classifyIntent(query);
    const context = await assembleContext(req.user!.id, req.tenant!.id, intent);
    const { system, user } = buildCopilotPrompt(query, intent, context, marketContext);

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Intent',      intent);
    res.flushHeaders();

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.write(`data: ${JSON.stringify({ chunk: 'AI Copilot requires GEMINI_API_KEY. Add it in Settings → AI Configuration.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    try {
      const streamModel = modelRouter.selectModel(req.user?.plan ?? 'pro');
      const url = await modelRouter.streamUrl(streamModel, geminiKey);
      const gemRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents:           [{ parts: [{ text: user }] }],
          generationConfig:   { maxOutputTokens: 800, temperature: 0.7 },
        }),
      });

      if (!gemRes.body) throw new Error('No response body from Gemini');

      const reader = gemRes.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (text) res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          } catch {}
        }
      }

      res.write(`data: ${JSON.stringify({ meta: { intent, disclaimer: 'Analytical output only — not financial advice.' } })}\n\n`);
    } catch (err: any) {
      logger.warn(`Copilot stream error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ chunk: `Analysis error: ${err.message}. Falling back to standard mode.` })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }));

  /**
   * POST /api/copilot/session-debrief
   * End-of-session AI-generated debrief narrative.
   */
  r.post('/session-debrief', requirePlan('starter', 'growth', 'enterprise', 'white_label', 'pro'), wrap(async (req: Request, res: Response) => {
    const { trades, sessionPnl, sessionDuration, instruments } = req.body;

    if (!trades || !Array.isArray(trades)) {
      res.status(400).json({ error: 'trades array required' });
      return;
    }

    const wins    = trades.filter((t: any) => t.result === 'win').length;
    const losses  = trades.filter((t: any) => t.result === 'loss').length;
    const bestTrade = trades.reduce((best: any, t: any) =>
      (t.pnl ?? -Infinity) > (best.pnl ?? -Infinity) ? t : best, trades[0]);

    const system = 'You are a trading performance coach providing end-of-session feedback. Be specific, actionable, and encouraging. Reference actual trade data.';
    const user   = `SESSION DEBRIEF REQUEST:
Trades: ${trades.length} total (${wins}W/${losses}L)
Session PnL: ${sessionPnl ?? 'unknown'}
Duration: ${sessionDuration ?? 'unknown'} minutes
Instruments: ${(instruments ?? []).join(', ')}
Best trade: ${bestTrade ? `${bestTrade.sym} +${bestTrade.pnl}` : 'N/A'}

Generate a professional session debrief covering:
1. Performance summary (1 sentence)
2. Best decision (1 sentence)
3. Area to improve (1 sentence)
4. Tomorrow's focus (1 sentence)`;

    const model  = modelRouter.selectModel(req.user!.plan as any);
    const text   = await modelRouter.call(model, system, user, 400);

    res.json({ debrief: text, model, trades: trades.length, wins, losses, sessionPnl });
  }));

  /**
   * POST /api/copilot/journal-insight
   * AI sentiment analysis + insight on journal entry.
   */
  r.post('/journal-insight', requirePlan('starter', 'growth', 'enterprise', 'white_label', 'pro'), wrap(async (req: Request, res: Response) => {
    const { journalText, tradeData } = req.body;
    if (!journalText) { res.status(400).json({ error: 'journalText required' }); return; }

    const system = 'You are a trading psychology analyst. Analyze this journal entry for emotional state, cognitive biases, and key patterns. Be concise and evidence-based.';
    const user   = `JOURNAL ENTRY:
"${journalText}"
${tradeData ? `\nTRADE DATA: ${JSON.stringify(tradeData)}` : ''}

Provide JSON: {
  "sentiment": "positive|negative|neutral",
  "sentimentScore": 0-100,
  "emotionalSignals": ["..."],
  "insight": "1-2 sentence insight",
  "suggestion": "1 actionable suggestion"
}`;

    const model  = modelRouter.selectModel(req.user!.plan as any);
    const raw    = await modelRouter.call(model, system, user, 300);

    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      res.json({ ...parsed, model });
    } catch {
      res.json({ insight: raw, model });
    }
  }));

  /**
   * POST /api/copilot/behavioral-coaching
   * Real-time intervention when behavioral signal is detected.
   */
  r.post('/behavioral-coaching', requirePlan('starter', 'growth', 'enterprise', 'white_label', 'pro'), wrap(async (req: Request, res: Response) => {
    const { signalType, tradeData, traderId } = req.body;

    if (!signalType) { res.status(400).json({ error: 'signalType required' }); return; }

    const coachingPrompts: Record<string, string> = {
      emotional_trade:    'The trader has just re-entered the market within 2 minutes of a stop-out. Provide an empathetic but firm intervention to pause and reset. Reference the psychological impact of emotional trading on performance. Suggest a specific 15-minute break protocol.',
      revenge_trade:      'The trader shows a revenge trading pattern: increasing position sizes after consecutive losses. Intervene to prevent account blowup. Suggest concrete steps to reset their risk parameters.',
      overtrade:          'The trader has exceeded their daily trade limit. Coach them to close the session and reflect. Explain overtrading psychology and how it erodes edge.',
      fomo_entry:         'The trader appears to have entered at a market extreme without pullback confirmation (FOMO entry). Help them assess the trade objectively and set clear invalidation levels.',
      session_fatigue:    'The trader\'s win rate is declining significantly after 4+ hours of trading. Suggest ending the session and explain session fatigue and cognitive decline.',
      risk_drift:         'The trader\'s stop distances have been expanding over their last 20 trades (risk drift). Help them reconnect with their risk plan and reset position sizing.',
    };

    const prompt = coachingPrompts[signalType] ?? 'Provide supportive performance coaching to help this trader improve their decision-making.';
    const tradeContext = tradeData ? `\nRecent trade context: ${JSON.stringify(tradeData)}` : '';

    const system = 'You are a professional trading performance coach and behavioral specialist. You work with institutional traders. Be empathetic, specific, and actionable. Reference data where available.';
    const user   = `BEHAVIORAL SIGNAL DETECTED: ${signalType}
${tradeContext}

${prompt}

Keep response under 150 words. Be direct but compassionate.`;

    const model = modelRouter.selectModel(req.user!.plan as any);
    const text  = await modelRouter.call(model, system, user, 200);

    // Log the behavioral intervention
    logger.info(`Behavioral coaching delivered: user=${traderId ?? req.user!.id} signal=${signalType}`);

    res.json({
      coaching:    text,
      signalType,
      model,
      timestamp:   new Date().toISOString(),
      disclaimer:  'Analytical coaching — not financial advice.',
    });
  }));

  return r;
}
