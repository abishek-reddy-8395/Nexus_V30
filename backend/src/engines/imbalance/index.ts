/**
 * Nexus V30 — Imbalance Engine (FVG)
 * Ported from v2 Engine.js ImbalanceEngine.
 * Stateful per storeKey — incremental lifecycle tracking.
 */

import type { Candle } from '../market-structure/index';
import type { LiquiditySweep } from '../liquidity/index';

export type FvgStatus = 'FRESH'|'PARTIALLY_FILLED'|'MITIGATED'|'REACTIVATED'|'INVALIDATED';

export interface FairValueGap {
  type:         'BULL_FVG'|'BEAR_FVG';
  top:          number; bottom: number; mid: number; gap: number;
  time:         number; idx: number;
  status:       FvgStatus;
  fillPct:      number;
  qualityScore: number;
}

export interface ImbalanceResult {
  fvgs:        FairValueGap[];
  activeFvgs:  FairValueGap[];
  nearestBull: FairValueGap | null;
  nearestBear: FairValueGap | null;
  score:       number;
}

interface FvgStore { fvgs: FairValueGap[]; lastIdx: number; }
const _stores = new Map<string, FvgStore>();

function scoreFVG(fvg: FairValueGap, candles: Candle[], atr: number, sweeps: LiquiditySweep[]): number {
  let score = 0;
  score += Math.min(30, Math.round((fvg.gap / Math.max(atr, 1e-8)) * 20));
  const ic = candles[fvg.idx];
  if (ic) score += Math.min(25, Math.round((Math.abs(ic.close - ic.open) / Math.max(atr, 1e-8)) * 12));
  const dir = fvg.type === 'BULL_FVG' ? 'SWEEP_BULL' : 'SWEEP_BEAR';
  if (sweeps.some(s => s.idx < fvg.idx && s.idx > fvg.idx - 10 && s.type === dir)) score += 25;
  return Math.min(100, score);
}

function updateFVGState(fvg: FairValueGap, newCandles: Candle[], atr: number): void {
  if (fvg.status === 'INVALIDATED') return;
  for (const c of newCandles) {
    if (fvg.type === 'BULL_FVG') {
      if (['REACTIVATED','FRESH','PARTIALLY_FILLED'].includes(fvg.status)) {
        if (c.low <= fvg.top) {
          const filled = Math.min(1, (fvg.top - Math.max(c.low, fvg.bottom)) / Math.max(fvg.top - fvg.bottom, 1e-10));
          fvg.fillPct = Math.max(fvg.fillPct, filled * 100);
          if (fvg.fillPct >= 50 && fvg.status === 'FRESH') fvg.status = 'PARTIALLY_FILLED';
          if (c.low <= fvg.bottom || fvg.fillPct >= 95)   fvg.status = 'MITIGATED';
        }
      } else if (fvg.status === 'MITIGATED') {
        if (c.low <= fvg.top && c.close > fvg.bottom) { fvg.status = 'REACTIVATED'; return; }
        if (c.close < fvg.bottom - atr * 0.3)         { fvg.status = 'INVALIDATED'; return; }
      }
    } else {
      if (['REACTIVATED','FRESH','PARTIALLY_FILLED'].includes(fvg.status)) {
        if (c.high >= fvg.bottom) {
          const filled = Math.min(1, (Math.min(c.high, fvg.top) - fvg.bottom) / Math.max(fvg.top - fvg.bottom, 1e-10));
          fvg.fillPct = Math.max(fvg.fillPct, filled * 100);
          if (fvg.fillPct >= 50 && fvg.status === 'FRESH') fvg.status = 'PARTIALLY_FILLED';
          if (c.high >= fvg.top || fvg.fillPct >= 95)     fvg.status = 'MITIGATED';
        }
      } else if (fvg.status === 'MITIGATED') {
        if (c.high >= fvg.bottom && c.close < fvg.top) { fvg.status = 'REACTIVATED'; return; }
        if (c.close > fvg.top + atr * 0.3)             { fvg.status = 'INVALIDATED'; return; }
      }
    }
  }
}

export class ImbalanceEngine {
  run(candles: Candle[], atr: number, sweeps: LiquiditySweep[], storeKey: string): ImbalanceResult {
    if (!candles || candles.length < 3) return { fvgs: [], activeFvgs: [], nearestBull: null, nearestBear: null, score: 0 };

    const store: FvgStore = _stores.get(storeKey) ?? { fvgs: [], lastIdx: 0 };
    _stores.set(storeKey, store);
    const minGap   = atr * 0.2;
    const startIdx = Math.max(2, store.lastIdx);

    for (let i = startIdx; i < candles.length; i++) {
      const c0 = candles[i-2], c1 = candles[i-1], c2 = candles[i];
      if (c2.low > c0.high && (c2.low - c0.high) >= minGap) {
        const fvg: FairValueGap = { type: 'BULL_FVG', top: c2.low, bottom: c0.high, mid: (c2.low + c0.high)/2, gap: c2.low - c0.high, time: c1.time, idx: i-1, status: 'FRESH', fillPct: 0, qualityScore: 0 };
        fvg.qualityScore = scoreFVG(fvg, candles, atr, sweeps);
        store.fvgs.push(fvg);
      }
      if (c0.low > c2.high && (c0.low - c2.high) >= minGap) {
        const fvg: FairValueGap = { type: 'BEAR_FVG', top: c0.low, bottom: c2.high, mid: (c0.low + c2.high)/2, gap: c0.low - c2.high, time: c1.time, idx: i-1, status: 'FRESH', fillPct: 0, qualityScore: 0 };
        fvg.qualityScore = scoreFVG(fvg, candles, atr, sweeps);
        store.fvgs.push(fvg);
      }
    }
    store.lastIdx = candles.length;

    const newSlice = candles.slice(Math.max(0, startIdx - 2));
    store.fvgs.forEach(fvg => updateFVGState(fvg, newSlice, atr));
    // [FIX-FVGCAP]
    store.fvgs = store.fvgs.filter(f => f.status !== 'INVALIDATED' || (candles.length - f.idx < 200));
    if (store.fvgs.length > 100) store.fvgs = store.fvgs.slice(-100);

    const price      = candles[candles.length - 1].close;
    const sorted     = [...store.fvgs].sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price));
    const activeFvgs = sorted.filter(f => f.status !== 'INVALIDATED' && f.status !== 'MITIGATED');
    const nearestBull = activeFvgs.find(f => f.type === 'BULL_FVG') ?? null;
    const nearestBear = activeFvgs.find(f => f.type === 'BEAR_FVG') ?? null;
    const score = Math.min(15, activeFvgs.filter(f => f.qualityScore >= 60).length * 5);

    return { fvgs: sorted.slice(0, 12), activeFvgs, nearestBull, nearestBear, score };
  }
}
