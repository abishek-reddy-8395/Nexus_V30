/**
 * Nexus V30 — Regime Engine
 * Ported from v2 Engine.js RegimeEngine [M3][S2].
 * 14 distinct regimes with hysteresis confirmation.
 */

import type { StructureResult } from '../market-structure/index';
import type { LiquidityResult } from '../liquidity/index';

export type RegimeName =
  | 'TRENDING_BULL' | 'TRENDING_BEAR'
  | 'EXPANSION_BULL' | 'EXPANSION_BEAR'
  | 'PULLBACK_IN_UPTREND' | 'PULLBACK_IN_DOWNTREND'
  | 'RANGING' | 'COMPRESSION' | 'ACCUMULATION' | 'DISTRIBUTION'
  | 'MANIPULATION' | 'MEAN_REVERSION' | 'VOLATILITY_SHOCK'
  | 'REVERSAL_TRANSITION' | 'REVERSAL_WATCH';

export interface RegimeMeta {
  confThreshold: number;
  sigAggression: number;
  stopMult:      number;
  tpMult:        number;
  biasWeight:    { bull: number; bear: number };
  maxConviction?:number;
}

export interface RegimeResult {
  regime:     RegimeName;
  meta:       RegimeMeta;
  volatility: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'COMPRESSED';
  volRatio:   number;
  score:      number;
  context:    string;
}

const BYPASS_HYSTERESIS = new Set(['VOLATILITY_SHOCK', 'MANIPULATION']);

const REGIMES: Record<RegimeName, RegimeMeta> = {
  TRENDING_BULL:          { confThreshold: 60,  sigAggression: 1.0, stopMult: 1.0, tpMult: 1.2, biasWeight: { bull: 1.3, bear: 0.7 } },
  TRENDING_BEAR:          { confThreshold: 60,  sigAggression: 1.0, stopMult: 1.0, tpMult: 1.2, biasWeight: { bull: 0.7, bear: 1.3 } },
  EXPANSION_BULL:         { confThreshold: 55,  sigAggression: 1.2, stopMult: 1.3, tpMult: 1.5, biasWeight: { bull: 1.5, bear: 0.5 } },
  EXPANSION_BEAR:         { confThreshold: 55,  sigAggression: 1.2, stopMult: 1.3, tpMult: 1.5, biasWeight: { bull: 0.5, bear: 1.5 } },
  PULLBACK_IN_UPTREND:    { confThreshold: 65,  sigAggression: 0.9, stopMult: 0.9, tpMult: 1.3, biasWeight: { bull: 1.6, bear: 0.4 } },
  PULLBACK_IN_DOWNTREND:  { confThreshold: 65,  sigAggression: 0.9, stopMult: 0.9, tpMult: 1.3, biasWeight: { bull: 0.4, bear: 1.6 } },
  RANGING:                { confThreshold: 75,  sigAggression: 0.6, stopMult: 0.7, tpMult: 0.8, biasWeight: { bull: 1.0, bear: 1.0 } },
  COMPRESSION:            { confThreshold: 80,  sigAggression: 0.4, stopMult: 0.6, tpMult: 0.6, biasWeight: { bull: 1.0, bear: 1.0 } },
  ACCUMULATION:           { confThreshold: 65,  sigAggression: 0.8, stopMult: 0.9, tpMult: 1.3, biasWeight: { bull: 1.2, bear: 0.9 } },
  DISTRIBUTION:           { confThreshold: 65,  sigAggression: 0.8, stopMult: 0.9, tpMult: 1.3, biasWeight: { bull: 0.9, bear: 1.2 } },
  MANIPULATION:           { confThreshold: 70,  sigAggression: 0.7, stopMult: 1.1, tpMult: 1.4, biasWeight: { bull: 1.1, bear: 1.1 } },
  MEAN_REVERSION:         { confThreshold: 72,  sigAggression: 0.7, stopMult: 0.8, tpMult: 1.0, biasWeight: { bull: 1.0, bear: 1.0 } },
  VOLATILITY_SHOCK:       { confThreshold: 80,  sigAggression: 0.5, stopMult: 1.5, tpMult: 1.8, biasWeight: { bull: 1.0, bear: 1.0 } },
  REVERSAL_TRANSITION:    { confThreshold: 68,  sigAggression: 0.9, stopMult: 1.0, tpMult: 1.3, biasWeight: { bull: 1.1, bear: 1.1 } },
  REVERSAL_WATCH:         { confThreshold: 58,  sigAggression: 0.6, stopMult: 0.9, tpMult: 1.0, biasWeight: { bull: 1.1, bear: 1.1 }, maxConviction: 70 },
};

const CONTEXT: Record<RegimeName, string> = {
  EXPANSION_BULL:         'Bullish expansion — displacement confirms momentum. Pullbacks to OBs/FVGs are primary entries.',
  EXPANSION_BEAR:         'Bearish expansion — selling pressure confirmed. Rallies to OBs/FVGs are primary entries.',
  RANGING:                'Range-bound — trade extremes only. Avoid mid-range entries.',
  COMPRESSION:            'ATR compressed — energy building. Await expansion trigger before entry.',
  TRENDING_BULL:          'Bullish trend continuation — pullbacks to OBs/FVGs are primary entries.',
  TRENDING_BEAR:          'Bearish trend continuation — rallies to OBs are primary entries.',
  ACCUMULATION:           'Smart money accumulation — buy sweeps of lows only.',
  DISTRIBUTION:           'Smart money distribution — sell sweeps of highs only.',
  MANIPULATION:           'Bi-directional sweeps — await clear directional commitment before entry.',
  MEAN_REVERSION:         'Price at range extreme — fade with tight risk.',
  VOLATILITY_SHOCK:       'Extreme volatility — reduce size, widen stops. Wait for shock candle to close.',
  REVERSAL_TRANSITION:    'CHoCH confirmed (2x) — allow structure to prove direction before full commitment.',
  REVERSAL_WATCH:         'Single CHoCH detected — early reversal signal. Reduced conviction (max 70). Await second CHoCH for full commitment.',
  PULLBACK_IN_UPTREND:    'D1/H4 bullish — LTF pulling back. Wait for M15/H1 CHoCH bullish + OB/FVG touch for long entry.',
  PULLBACK_IN_DOWNTREND:  'D1/H4 bearish — LTF bouncing. Wait for M15/H1 CHoCH bearish + OB/FVG touch for short entry.',
};

export class RegimeEngine {
  private regimeHistory:  string[] = [];
  private chochBullCount  = 0;
  private chochBearCount  = 0;

  classify(candles: any[], structure: StructureResult, liquidity: LiquidityResult, atr: number, avgATR: number, mtfAlignment?: string): RegimeResult {
    if (!candles || candles.length < 20) {
      return this._build('RANGING', 'NORMAL', 1, atr);
    }
    const volRatio = avgATR > 0 ? atr / avgATR : 1;
    const trend    = structure.trend;
    const recentDisp   = structure.displacements.slice(-3);
    const recentSweeps = liquidity.sweeps.slice(-3);
    const recentEvents = structure.events.slice(-4);

    let volatility: RegimeResult['volatility'] = 'NORMAL';
    if      (volRatio >= 1.5) volatility = 'HIGH';
    else if (volRatio >= 1.2) volatility = 'ELEVATED';
    else if (volRatio <= 0.6) volatility = 'COMPRESSED';
    else if (volRatio <= 0.8) volatility = 'LOW';

    const isComp     = candles.slice(-10).reduce((s: number, c: any) => s + (c.high - c.low), 0) / 10 < atr * 0.65 && volRatio < 0.75;
    const hasBullD   = recentDisp.filter(d => d.direction === 'BULL').length >= 2 && structure.hasBos;
    const hasBearD   = recentDisp.filter(d => d.direction === 'BEAR').length >= 2 && structure.hasBos;
    const isVolShock = volRatio >= 2.0;
    const bullSweeps = recentSweeps.filter(s => s.type === 'SWEEP_BULL').length;
    const bearSweeps = recentSweeps.filter(s => s.type === 'SWEEP_BEAR').length;
    const isManip    = bullSweeps >= 1 && bearSweeps >= 1;

    // [S2] CHoCH confirmation gate
    const chochBull = recentEvents.filter(e => e.type === 'CHOCH_BULL').length;
    const chochBear = recentEvents.filter(e => e.type === 'CHOCH_BEAR').length;
    if (chochBull > 0) { this.chochBullCount += chochBull; this.chochBearCount = 0; }
    if (chochBear > 0) { this.chochBearCount += chochBear; this.chochBullCount = 0; }
    if (!chochBull && !chochBear) { this.chochBullCount = Math.max(0, this.chochBullCount - 1); this.chochBearCount = Math.max(0, this.chochBearCount - 1); }

    const isReversalWatch = (this.chochBullCount === 1 || this.chochBearCount === 1) && !hasBullD && !hasBearD;
    const isRevTrans      = (this.chochBullCount >= 2 || this.chochBearCount >= 2) && !hasBullD && !hasBearD;

    const isPullbackUp   = mtfAlignment === 'PULLBACK_IN_UPTREND';
    const isPullbackDown = mtfAlignment === 'PULLBACK_IN_DOWNTREND';

    const regime: RegimeName =
      isVolShock                              ? 'VOLATILITY_SHOCK'        :
      isComp && volatility === 'COMPRESSED'   ? 'COMPRESSION'             :
      isManip                                 ? 'MANIPULATION'            :
      isPullbackUp                            ? 'PULLBACK_IN_UPTREND'     :
      isPullbackDown                          ? 'PULLBACK_IN_DOWNTREND'   :
      isRevTrans                              ? 'REVERSAL_TRANSITION'     :
      isReversalWatch                         ? 'REVERSAL_WATCH'          :
      hasBullD && volatility !== 'COMPRESSED' ? 'EXPANSION_BULL'          :
      hasBearD && volatility !== 'COMPRESSED' ? 'EXPANSION_BEAR'          :
      trend === 'BULLISH'                     ? 'TRENDING_BULL'           :
      trend === 'BEARISH'                     ? 'TRENDING_BEAR'           :
      bullSweeps >= 1                         ? 'ACCUMULATION'            :
      bearSweeps >= 1                         ? 'DISTRIBUTION'            :
      'RANGING';

    // Hysteresis confirmation (3-bar stable)
    let confirmed: RegimeName;
    if (BYPASS_HYSTERESIS.has(regime)) {
      confirmed = regime; this.regimeHistory = [regime];
    } else {
      this.regimeHistory.push(regime);
      if (this.regimeHistory.length > 3) this.regimeHistory.shift();
      confirmed = (this.regimeHistory.length >= 3 && this.regimeHistory.every(r => r === regime))
        ? regime : (this.regimeHistory[0] as RegimeName ?? regime);
    }

    return this._build(confirmed, volatility, volRatio, atr);
  }

  private _build(regime: RegimeName, volatility: RegimeResult['volatility'], volRatio: number, atr: number): RegimeResult {
    return { regime, meta: REGIMES[regime] ?? REGIMES.RANGING, volatility, volRatio, score: 60, context: CONTEXT[regime] ?? '' };
  }

  applyToConfluence(score: number, dir: 'BULL'|'BEAR'|'NEUTRAL', regimeResult: RegimeResult): { adjustedScore: number; threshold: number; valid: boolean } {
    const bw  = regimeResult.meta.biasWeight;
    const adj = Math.min(100, Math.max(0, Math.round(score * (dir === 'BULL' ? bw.bull : dir === 'BEAR' ? bw.bear : 1.0))));
    return { adjustedScore: adj, threshold: regimeResult.meta.confThreshold, valid: adj >= regimeResult.meta.confThreshold };
  }
}
