/**
 * Nexus V30 — Order Block Engine
 * Ported from v2 Engine.js OrderBlockEngine.
 * Stateful per storeKey — incremental mitigation tracking.
 */

import type { Candle, StructureEvent } from '../market-structure/index';
import type { LiquiditySweep } from '../liquidity/index';

export type OBStatus = 'FRESH'|'TESTED'|'BREAKER';

export interface OrderBlock {
  type:           'BULL_OB'|'BEAR_OB';
  top:            number; bottom: number; mid: number;
  time:           number; idx: number;
  impulseStrength:number;
  brokeStructure: boolean;
  status:         OBStatus;
  mitigationPct:  number;
  validityScore:  number;
}

export interface OrderBlockResult {
  blocks:      OrderBlock[];
  activeBlocks:OrderBlock[];
  nearestBull: OrderBlock | null;
  nearestBear: OrderBlock | null;
  score:       number;
}

interface OBStore { obs: OrderBlock[]; lastIdx: number; }
const _stores = new Map<string, OBStore>();

function scoreOB(ob: OrderBlock, sweeps: LiquiditySweep[]): number {
  let score = 0;
  const dir = ob.type === 'BULL_OB' ? 'SWEEP_BULL' : 'SWEEP_BEAR';
  if (sweeps.some(s => s.idx < ob.idx && s.idx > ob.idx - 15 && s.type === dir)) score += 30;
  score += Math.min(25, Math.round(ob.impulseStrength * 10));
  if (ob.brokeStructure) score += 20;
  if (ob.status === 'TESTED' && ob.mitigationPct < 80) score += 10;
  return Math.min(100, score);
}

function updateOBState(ob: OrderBlock, newCandles: Candle[]): void {
  if (ob.status === 'BREAKER') return;
  for (const c of newCandles) {
    if (ob.type === 'BULL_OB' && c.low <= ob.top) {
      const depth = (ob.top - Math.max(c.low, ob.bottom)) / Math.max(ob.top - ob.bottom, 1e-10);
      ob.mitigationPct = Math.max(ob.mitigationPct, depth * 100);
      if (ob.mitigationPct >= 50) ob.status = 'TESTED';
      if (c.close < ob.bottom)    { ob.status = 'BREAKER'; return; }
    }
    if (ob.type === 'BEAR_OB' && c.high >= ob.bottom) {
      const depth = (Math.min(c.high, ob.top) - ob.bottom) / Math.max(ob.top - ob.bottom, 1e-10);
      ob.mitigationPct = Math.max(ob.mitigationPct, depth * 100);
      if (ob.mitigationPct >= 50) ob.status = 'TESTED';
      if (c.close > ob.top)       { ob.status = 'BREAKER'; return; }
    }
  }
}

export class OrderBlockEngine {
  run(candles: Candle[], structEvents: StructureEvent[], atr: number, sweeps: LiquiditySweep[], storeKey: string): OrderBlockResult {
    if (!candles || candles.length < 5) return { blocks: [], activeBlocks: [], nearestBull: null, nearestBear: null, score: 0 };

    const store: OBStore = _stores.get(storeKey) ?? { obs: [], lastIdx: 0 };
    _stores.set(storeKey, store);
    const thr      = atr * 1.2;
    const startIdx = Math.max(1, store.lastIdx);

    for (let i = startIdx; i < candles.length - 1; i++) {
      const c = candles[i];
      // Bullish OB: bearish candle followed by impulse up
      if (c.close < c.open) {
        let impulse = 0, reached = i;
        for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
          impulse = candles[j].close - c.low; reached = j;
          if (impulse >= thr) break;
        }
        if (impulse >= thr) {
          const brokeSt = structEvents.some(e => e.type.includes('BULL') && e.idx >= i + 1 && e.idx <= reached + 2);
          store.obs.push({ type: 'BULL_OB', top: c.open, bottom: c.low, mid: (c.open + c.low) / 2, time: c.time, idx: i, impulseStrength: impulse / atr, brokeStructure: brokeSt, status: 'FRESH', mitigationPct: 0, validityScore: 0 });
        }
      }
      // Bearish OB: bullish candle followed by impulse down
      if (c.close > c.open) {
        let impulse = 0, reached = i;
        for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
          impulse = c.high - candles[j].close; reached = j;
          if (impulse >= thr) break;
        }
        if (impulse >= thr) {
          const brokeSt = structEvents.some(e => e.type.includes('BEAR') && e.idx >= i + 1 && e.idx <= reached + 2);
          store.obs.push({ type: 'BEAR_OB', top: c.high, bottom: c.close, mid: (c.high + c.close) / 2, time: c.time, idx: i, impulseStrength: impulse / atr, brokeStructure: brokeSt, status: 'FRESH', mitigationPct: 0, validityScore: 0 });
        }
      }
    }
    store.lastIdx = candles.length;

    // Score newly added OBs
    store.obs.forEach(ob => { if (ob.validityScore === 0) ob.validityScore = scoreOB(ob, sweeps); });

    // Update mitigation state
    const newSlice = candles.slice(Math.max(0, startIdx - 1));
    store.obs.forEach(ob => updateOBState(ob, newSlice));

    // [FIX-OBCAP]
    store.obs = store.obs.filter(o => o.status !== 'BREAKER' || (candles.length - o.idx < 200));
    if (store.obs.length > 60) store.obs = store.obs.slice(-60);

    const price       = candles[candles.length - 1].close;
    const activeBlocks = store.obs.filter(o => o.status !== 'BREAKER')
      .sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price));

    const nearestBull = activeBlocks.find(o => o.type === 'BULL_OB') ?? null;
    const nearestBear = activeBlocks.find(o => o.type === 'BEAR_OB') ?? null;
    const score = Math.min(20, activeBlocks.filter(o => o.validityScore >= 60 && o.status === 'FRESH').length * 10);

    return { blocks: activeBlocks.slice(0, 8), activeBlocks, nearestBull, nearestBear, score };
  }
}
