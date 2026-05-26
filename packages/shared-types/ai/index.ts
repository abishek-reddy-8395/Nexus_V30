/**
 * @nexus-v30/shared-types — AI Contracts
 *
 * Input/output types for the AI layer.
 * AI receives sanitised engine outputs (same as the frontend receives).
 * AI never sees raw engine internals.
 *
 * Critical rule: nothing in this file can cause a trade to execute.
 * AI is an analysis/explanation layer only.
 */

import type { EngineAnalysisResult } from '../engine/index';

// ── AI inputs — always sanitised engine data ───────────────────────────
export interface AiMarketContextInput {
  instrument:  string;
  timeframe:   number;
  price:       number;
  analysis:    Pick<EngineAnalysisResult, 'signal' | 'confluence' | 'structure' | 'session'>;
  mode:        'scalp' | 'intraday' | 'positional';
}

export interface AiWarRoomInput {
  mode:        'macro' | 'liq' | 'flow' | 'news' | 'sentiment' | 'forecast';
  instrument:  string;
  price:       number;
  session:     string;
  confluence?: number;
  signal?:     string;
  // Additional context — always sanitised
  [key: string]: unknown;
}

export interface AiPromptInput {
  prompt:    string;
  maxTokens: number;
  userId:    string;
  tenantId:  string;
  plan:      'free' | 'pro' | 'enterprise';
}

// ── AI outputs — analysis and narration only ───────────────────────────
export interface AiNarrativeOutput {
  narrative:  string;   // 2-3 sentence market narrative
  brief:      string;   // 1 sentence summary
  riskNote:   string;   // key risk to monitor
  model:      string;   // which model generated this
  tokensUsed?: number;
}

export interface AiWarRoomOutput {
  text:  string;   // free-form analysis
  model: string;
  mode:  string;
}

export interface AiPromptOutput {
  text:  string;
  model: string;
}

// ── What AI is NOT allowed to return ──────────────────────────────────
// These types should never appear in AI layer responses:
// - ExecutionOrder
// - RiskAdjustment
// - PositionSize
// - LotSize
// AI narrates. It does not decide. Execution is a separate bounded context.
