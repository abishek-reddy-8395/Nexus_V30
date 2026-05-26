/**
 * Nexus V30 — Prompt Orchestration (extended with Copilot intents)
 *
 * Central registry of all AI prompts. Server-side only — never sent to client.
 * Each prompt has a version for rollback tracking.
 */

export type PromptKey =
  // Market intelligence
  | 'market_narrative'
  | 'war_room_macro'
  | 'war_room_liquidity'
  | 'war_room_flow'
  | 'war_room_sentiment'
  | 'war_room_forecast'
  | 'trade_reasoning'
  | 'calendar_impact'
  | 'scanner_summary'
  // AI Copilot (Phase 3 additions)
  | 'copilot_market_analysis'
  | 'copilot_trade_review'
  | 'copilot_journal_analysis'
  | 'copilot_education'
  | 'copilot_behavioral_coaching'
  | 'copilot_session_debrief'
  | 'copilot_weekly_insight';

export interface Prompt {
  key:      PromptKey;
  version:  number;
  system:   string;
  template: (vars: Record<string, any>) => string;
}

export const PROMPTS: Record<PromptKey, Prompt> = {
  // ─── Existing market intelligence ─────────────────────────────────────────
  market_narrative: {
    key: 'market_narrative', version: 3,
    system: 'You are an institutional SMC trading analyst for NEXUS. Be concise, data-driven, and specific. Respond with valid JSON only.',
    template: (v) => `
Instrument: ${v.sym} | TF: ${v.tf}m | Price: ${v.price}
Session: ${v.session} | Regime: ${v.regime} | Confluence: ${v.confluence}/100
Signal: ${v.bias} | Entry: ${v.entry ?? '—'} | SL: ${v.sl ?? '—'} | R:R: ${v.rr ?? '—'}
Structure: ${v.structure} | Liquidity: ${v.liquidity}

Provide: { "narrative": "2-3 sentences", "brief": "1 sentence", "riskNote": "1 sentence" }`.trim(),
  },

  war_room_macro: {
    key: 'war_room_macro', version: 2,
    system: 'You are a macro market analyst. Provide institutional-grade market context. JSON only.',
    template: (v) => `
Current watchlist data: ${JSON.stringify(v.watchlist)}
Session: ${v.session} | Time: ${v.utcTime}

Analyze the macro picture across all instruments. Identify correlations, key regimes, and institutional flow direction.
Respond: { "narrative": "...", "regimes": {...}, "correlations": "...", "keyWatch": "..." }`.trim(),
  },

  war_room_liquidity: {
    key: 'war_room_liquidity', version: 2,
    system: 'You are an SMC liquidity analyst. Focus on liquidity pools, sweeps, and institutional traps.',
    template: (v) => `
Instrument: ${v.sym} | Price: ${v.price}
BSL: ${v.bsl ?? '—'} | SSL: ${v.ssl ?? '—'}
Recent sweeps: ${JSON.stringify(v.sweeps)}

Identify likely liquidity targets and sweep scenarios. JSON: { "narrative": "...", "targets": [...], "riskNote": "..." }`.trim(),
  },

  war_room_flow: {
    key: 'war_room_flow', version: 1,
    system: 'You are a smart money flow analyst. Identify institutional accumulation and distribution.',
    template: (v) => `
Scanner results: ${JSON.stringify(v.scanResults)}
Interpret smart money positioning across markets. JSON: { "narrative": "...", "bullFlow": [...], "bearFlow": [...] }`.trim(),
  },

  war_room_sentiment: {
    key: 'war_room_sentiment', version: 1,
    system: 'You are a market sentiment analyst. Contrast retail positioning vs smart money.',
    template: (v) => `
Instrument: ${v.sym} | Confluence: ${v.confluence}/100 | Bias: ${v.bias}
Analyze retail vs smart money divergence. JSON: { "narrative": "...", "retailBias": "...", "smcBias": "...", "note": "..." }`.trim(),
  },

  war_room_forecast: {
    key: 'war_room_forecast', version: 1,
    system: 'You are a scenario analyst. Provide bullish, bearish, and base-case scenarios.',
    template: (v) => `
Instrument: ${v.sym} | Price: ${v.price} | Structure: ${v.structure}
Generate 3 price scenarios for the next session. JSON: { "bull": {...}, "bear": {...}, "base": {...} }`.trim(),
  },

  trade_reasoning: {
    key: 'trade_reasoning', version: 2,
    system: 'You are an SMC trade analyst. Explain trade rationale concisely for a professional trader.',
    template: (v) => `
${v.sym} | ${v.dir} | Entry: ${v.entry} | SL: ${v.sl} | TP: ${v.tp} | R:R: ${v.rr}
Confluence: ${v.confluence}/100 | Setup: ${v.setup}
Explain in 2 sentences why this is or isn't a valid SMC trade.
JSON: { "rationale": "...", "warnings": [...] }`.trim(),
  },

  calendar_impact: {
    key: 'calendar_impact', version: 1,
    system: 'You are a fundamental analyst. Assess event impact on currency pairs.',
    template: (v) => `
Event: ${v.event} | Currency: ${v.currency} | Impact: ${v.impact}
Forecast: ${v.forecast ?? 'N/A'} | Previous: ${v.previous ?? 'N/A'}
In one sentence, describe expected market impact. JSON: { "impact": "...", "affected": [...] }`.trim(),
  },

  scanner_summary: {
    key: 'scanner_summary', version: 1,
    system: 'You are an SMC scanner analyst. Summarize multi-symbol scan results.',
    template: (v) => `
Scan results: ${JSON.stringify(v.results)}
Session: ${v.session}
Summarize top 3 opportunities. JSON: { "summary": "...", "top": [...], "avoid": [...] }`.trim(),
  },

  // ─── AI Copilot prompts (Phase 3) ─────────────────────────────────────────

  copilot_market_analysis: {
    key: 'copilot_market_analysis', version: 1,
    system: 'You are an institutional SMC trading analyst for NEXUS AI Copilot. Synthesize live market context with the trader\'s question. Be specific about price levels, structure, and actionable insights. Never give financial advice — frame as analysis.',
    template: (v) => `
MARKET CONTEXT:
${v.marketContext ?? 'No live market context provided.'}

TRADER PROFILE: ${v.traderProfile ?? 'No profile data.'}

QUERY: ${v.query}

Provide specific SMC analysis addressing the query. Reference concrete price levels where possible. End with one specific thing to watch.`.trim(),
  },

  copilot_trade_review: {
    key: 'copilot_trade_review', version: 1,
    system: 'You are an SMC trade review specialist for NEXUS AI Copilot. Evaluate trades objectively using confluence, R:R, and market structure. Be constructive.',
    template: (v) => `
TRADE DATA: ${JSON.stringify(v.tradeData ?? {})}
RECENT PERFORMANCE: ${v.performanceSummary ?? 'No data.'}

QUERY: ${v.query}

Review the trade(s) objectively. Identify what was right, what could be improved, and one specific adjustment for next time.`.trim(),
  },

  copilot_journal_analysis: {
    key: 'copilot_journal_analysis', version: 1,
    system: 'You are a trading psychology and journal analyst for NEXUS AI Copilot. Identify patterns, emotional biases, and behavioral insights from journal data.',
    template: (v) => `
JOURNAL ENTRIES (last ${v.entryCount ?? 10}):
${v.journalSummary ?? 'No journal data.'}

QUERY: ${v.query}

Analyze the journal patterns. Identify recurring themes, emotional signals, and one concrete habit to build or break.`.trim(),
  },

  copilot_education: {
    key: 'copilot_education', version: 1,
    system: 'You are an SMC education specialist for NEXUS AI Copilot. Explain Smart Money Concepts clearly with examples. Adapt to professional traders.',
    template: (v) => `
TOPIC/QUERY: ${v.query}

Explain the concept clearly. Use a real-market example. Keep it under 200 words. End with how to apply it immediately.`.trim(),
  },

  copilot_behavioral_coaching: {
    key: 'copilot_behavioral_coaching', version: 1,
    system: 'You are a professional trading performance coach for NEXUS AI Copilot. Be empathetic, evidence-based, and actionable. Reference the trader\'s own data where possible.',
    template: (v) => `
TRADER DATA: ${v.traderProfile ?? 'No profile data.'}
DETECTED SIGNAL: ${v.behavioralSignal ?? 'General coaching request'}

QUERY: ${v.query}

Provide supportive coaching. Acknowledge their situation, reference their data, suggest one specific next action. Under 150 words.`.trim(),
  },

  copilot_session_debrief: {
    key: 'copilot_session_debrief', version: 1,
    system: 'You are a trading performance coach for NEXUS AI Copilot. Generate concise, specific session debriefs that help traders improve.',
    template: (v) => `
SESSION DATA:
Trades: ${v.tradeCount} (${v.wins}W/${v.losses}L)
PnL: ${v.pnl ?? 'unknown'}
Duration: ${v.duration ?? 'unknown'} min
Best trade: ${v.bestTrade ?? 'N/A'}
Instruments: ${v.instruments ?? 'N/A'}

Generate a 4-point debrief: (1) Performance summary, (2) Best decision, (3) Key improvement, (4) Tomorrow's focus. Each point 1 sentence.`.trim(),
  },

  copilot_weekly_insight: {
    key: 'copilot_weekly_insight', version: 1,
    system: 'You are a quantitative performance analyst for NEXUS AI Copilot. Generate data-driven weekly insights for trading teams.',
    template: (v) => `
WEEKLY DATA:
Win rate: ${v.winRate}% | Total trades: ${v.totalTrades}
Active traders: ${v.activeTraders}/${v.totalTraders}
Top instrument: ${v.topSym}
Aggregate PnL: ${v.pnl}

Generate 4 specific insights an org manager would care about. Each insight should reference the data and include a recommendation. Format as numbered list.`.trim(),
  },
};

export class PromptOrchestrator {
  build(key: PromptKey, vars: Record<string, any>): { system: string; user: string } {
    const prompt = PROMPTS[key];
    if (!prompt) throw new Error(`Unknown prompt key: ${key}`);
    return { system: prompt.system, user: prompt.template(vars) };
  }

  list(): Array<{ key: PromptKey; version: number }> {
    return Object.values(PROMPTS).map(p => ({ key: p.key, version: p.version }));
  }
}
