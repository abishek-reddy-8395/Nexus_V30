/**
 * Nexus V30 — Confluence Engine
 * Ported from v2 Engine.js ConfluenceEngine.
 * Regime-aware weights, full sub-score aggregation.
 */

import type { StructureResult } from '../market-structure/index';
import type { LiquidityResult } from '../liquidity/index';
import type { ImbalanceResult } from '../imbalance/index';
import type { OrderBlockResult } from '../order-block/index';

export interface ConfluenceInput {
  structure:     StructureResult;
  liquidity:     LiquidityResult;
  orderBlock:    OrderBlockResult;
  imbalance:     ImbalanceResult;
  mtfBias:       'BULL' | 'BEAR' | 'NEUTRAL';
  mtfAligned:    boolean;
  sessionWeight: number;
  regime:        string;
}

export interface ConfluenceScore {
  total:      number;   // 0–100
  structure:  number;
  mtf:        number;
  liquidity:  number;
  orderBlock: number;
  fvg:        number;
  session:    number;
  direction:  'BULL' | 'BEAR' | 'NEUTRAL';
}

// Base weights matching v2 ConfluenceEngine
const BASE_WEIGHTS = {
  structure: 25, mtf: 22, liquidity: 18,
  orderBlock: 12, fvg: 5, session: 10,
} as const;

// Regime overrides — only keys that differ from base
const REGIME_OVERRIDES: Record<string, Partial<typeof BASE_WEIGHTS>> = {
  RANGING:              { structure: 15, liquidity: 22, mtf: 18 },
  COMPRESSION:          { structure: 10, liquidity: 20, mtf: 15 },
  TRENDING_BULL:        { structure: 30, mtf: 25,       liquidity: 15 },
  TRENDING_BEAR:        { structure: 30, mtf: 25,       liquidity: 15 },
  EXPANSION_BULL:       { structure: 22, liquidity: 24, mtf: 20 },
  EXPANSION_BEAR:       { structure: 22, liquidity: 24, mtf: 20 },
  PULLBACK_IN_UPTREND:  { structure: 20, mtf: 28,       liquidity: 18 },
  PULLBACK_IN_DOWNTREND:{ structure: 20, mtf: 28,       liquidity: 18 },
  MANIPULATION:         { liquidity: 26, structure: 14, mtf: 16 },
  REVERSAL_WATCH:       { structure: 18, mtf: 20,       liquidity: 18 },
};

function getWeights(regime: string) {
  return { ...BASE_WEIGHTS, ...(REGIME_OVERRIDES[regime] ?? {}) };
}

export class ConfluenceEngine {
  score(input: ConfluenceInput): ConfluenceScore {
    const w = getWeights(input.regime);
    const MAX = 100;

    // ── Structure sub-score ────────────────────────────────────────────
    let structScore = 0;
    if (input.structure.hasBos)   structScore += 40;
    if (input.structure.hasChoch) structScore += 20;
    const trend = input.structure.trend;
    if (trend === 'BULLISH' || trend === 'BEARISH') structScore += 40;
    const structure = Math.min(w.structure, Math.round((structScore / 100) * w.structure));

    // ── MTF alignment sub-score ────────────────────────────────────────
    let mtfRaw = input.mtfBias === 'NEUTRAL' ? 30 : input.mtfAligned ? 100 : 50;
    const mtf = Math.min(w.mtf, Math.round((mtfRaw / 100) * w.mtf));

    // ── Liquidity sub-score ────────────────────────────────────────────
    const liquidity = Math.min(w.liquidity, Math.round((input.liquidity.score / 30) * w.liquidity));

    // ── Order Block sub-score ──────────────────────────────────────────
    const orderBlock = Math.min(w.orderBlock, Math.round((input.orderBlock.score / 20) * w.orderBlock));

    // ── FVG sub-score ──────────────────────────────────────────────────
    const fvgRaw = input.imbalance.score;
    const fvg = Math.min(w.fvg, Math.round((fvgRaw / 15) * w.fvg));

    // ── Session sub-score ──────────────────────────────────────────────
    const sessRaw  = Math.min(1, (input.sessionWeight - 0.3) / 1.2); // normalise 0.3→1.5 to 0→1
    const session  = Math.min(w.session, Math.round(sessRaw * w.session));

    const total = Math.min(MAX, structure + mtf + liquidity + orderBlock + fvg + session);

    // Direction: from structure trend + MTF
    let direction: ConfluenceScore['direction'] = 'NEUTRAL';
    if (trend === 'BULLISH' && input.mtfBias !== 'BEAR') direction = 'BULL';
    else if (trend === 'BEARISH' && input.mtfBias !== 'BULL') direction = 'BEAR';
    else if (input.mtfBias !== 'NEUTRAL') direction = input.mtfBias;

    return { total, structure, mtf, liquidity, orderBlock, fvg, session, direction };
  }
}
