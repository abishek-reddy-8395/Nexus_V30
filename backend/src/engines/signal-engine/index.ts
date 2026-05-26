/**
 * Nexus V30 — Signal Engine
 * Ported from v2 Engine.js SignalEngine [F2][S2][S3][S4].
 * Generates final trade signal from confluence + regime + structure.
 */

import type { ConfluenceScore } from '../confluence-engine/index';
import type { RegimeResult } from '../regime-engine/index';
import type { OrderBlock } from '../order-block/index';
import type { FairValueGap } from '../imbalance/index';
import type { LiquidityResult } from '../liquidity/index';

export type Bias = 'BULL' | 'BEAR' | 'NEUTRAL' | 'WAIT';
export type Mode = 'scalp' | 'intraday' | 'positional';

export interface SignalInput {
  confluence:   ConfluenceScore;
  regime:       RegimeResult;
  price:        number;
  atr:          number;
  obs:          OrderBlock[];
  fvgs:         FairValueGap[];
  liquidity:    LiquidityResult;
  hasBos:       boolean;
  hasChoch:     boolean;
  mode:         Mode;
  spread?:      number;
}

export interface SignalOutput {
  bias:       Bias;
  entry:      number | null;
  sl:         number | null;
  tp1:        number | null;
  tp2:        number | null;
  rr:         string | null;
  conviction: number;
  setup:      string | null;
  reasoning:  string;
  isFade:     boolean;
}

// Mode-specific ATR multipliers matching v2 SignalEngine
const SL_MULT:  Record<Mode, number> = { scalp: 0.3,  intraday: 0.6,  positional: 1.2  };
const TP_MULT:  Record<Mode, number> = { scalp: 0.6,  intraday: 1.2,  positional: 2.4  };
const TP2_MULT: Record<Mode, number> = { scalp: 1.0,  intraday: 2.0,  positional: 3.6  };

export class SignalEngine {
  generate(input: SignalInput): SignalOutput {
    const { confluence, regime, price, atr, obs, fvgs, liquidity, mode } = input;
    const meta   = regime.meta;
    const score  = confluence.total;
    const dir    = confluence.direction;
    const thresh = Math.max(50, meta.confThreshold);

    const noTrade = (reason: string, bias: Bias = 'WAIT'): SignalOutput => ({
      bias, entry: null, sl: null, tp1: null, tp2: null, rr: null,
      conviction: score, setup: null, reasoning: reason, isFade: false,
    });

    if (score < thresh || dir === 'NEUTRAL') return noTrade('Insufficient confluence.');

    // [S2] Cap conviction in REVERSAL_WATCH
    const maxConv  = meta.maxConviction;
    const finalSc  = maxConv != null ? Math.min(score, maxConv) : score;

    const isBull   = dir === 'BULL';
    const sm       = meta.stopMult  ?? 1.0;
    const tm       = meta.tpMult    ?? 1.0;

    let slDist = atr * SL_MULT[mode] * sm;
    const tpDist  = atr * TP_MULT[mode]  * tm;
    const tp2Dist = atr * TP2_MULT[mode] * tm;

    // [F2] SL minimum floor — 5 pips = 0.0005 (forex) or 0.5 (gold)
    const minSL = 0.0005;
    if (slDist < minSL) slDist = minSL;

    // Entry — prefer OB or FVG level over spot price
    let entry = price;
    const nearOB = obs.find(o =>
      isBull ? (o.type === 'BULL_OB' && o.status !== 'BREAKER' && Math.abs(o.top    - price) < atr * 0.5)
             : (o.type === 'BEAR_OB' && o.status !== 'BREAKER' && Math.abs(o.bottom - price) < atr * 0.5)
    );
    if (nearOB) entry = isBull ? nearOB.top : nearOB.bottom;

    const nearFVG = !nearOB ? fvgs.find(f =>
      ['FRESH','REACTIVATED'].includes(f.status) && Math.abs(f.mid - price) < atr * 0.8
    ) : undefined;
    if (nearFVG) entry = isBull ? nearFVG.bottom : nearFVG.top;

    // Clamp entry to price ± 0.5 ATR
    if (Math.abs(entry - price) > atr * 0.5) entry = price;

    // SL — place beyond OB if near one
    let sl = isBull ? entry - slDist : entry + slDist;
    if (nearOB) sl = isBull ? nearOB.bottom - atr * 0.1 : nearOB.top + atr * 0.1;

    // TP1 — prefer liquidity pool target
    let tp1 = isBull ? entry + tpDist : entry - tpDist;
    const liqTarget = isBull
      ? liquidity.eqh.sort((a, b) => a.price - b.price).find(l => l.price > entry + atr * 0.5)
      : liquidity.eql.sort((a, b) => b.price - a.price).find(l => l.price < entry - atr * 0.5);
    if (liqTarget && Math.abs(liqTarget.price - entry) < atr * 4) tp1 = liqTarget.price;

    const tp2 = isBull ? entry + tp2Dist : entry - tp2Dist;

    // R:R
    const slPips = Math.abs(entry - sl);
    const tpPips = Math.abs(tp1   - entry);
    const rrRaw  = slPips > 0 ? tpPips / slPips : 0;
    const rr     = rrRaw > 0 ? `1:${rrRaw.toFixed(1)}` : null;

    const setup = nearOB ? (isBull ? 'OB_BULL_ENTRY' : 'OB_BEAR_ENTRY')
                : nearFVG ? (isBull ? 'FVG_BULL_ENTRY' : 'FVG_BEAR_ENTRY')
                : (isBull ? 'STRUCTURE_BULL' : 'STRUCTURE_BEAR');

    const reasoning = `${regime.regime} | ${dir} ${finalSc}/100 | ${setup} | R:R ${rr ?? '—'} | ${regime.context}`;

    return {
      bias:       dir as Bias,
      entry:      parseFloat(entry.toFixed(5)),
      sl:         parseFloat(sl.toFixed(5)),
      tp1:        parseFloat(tp1.toFixed(5)),
      tp2:        parseFloat(tp2.toFixed(5)),
      rr,
      conviction: finalSc,
      setup,
      reasoning,
      isFade:     false,
    };
  }
}
