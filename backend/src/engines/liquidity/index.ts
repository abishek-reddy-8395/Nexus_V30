/**
 * Nexus V30 — Liquidity Engine
 * Ported from v2 Engine.js LiquidityEngine.
 * Detects EQH/EQL pools, liquidity sweeps, inducements. Server-side only.
 */

import type { Candle, Swing } from '../market-structure/index';

export interface LiquidityPool {
  price: number; type: 'HI'|'LO'; touches: number;
  firstTime: number; lastTime: number;
  loadedness: 'FRESH'|'PRIMED'|'LOADED';
  sweepProbability: number; ageMs: number; strength: number;
}

export interface LiquiditySweep {
  type: 'SWEEP_BULL'|'SWEEP_BEAR'; level: LiquidityPool;
  time: number; idx: number; wickDepth: number; recovery: number;
}

export interface LiquidityResult {
  eqh:         LiquidityPool[];
  eql:         LiquidityPool[];
  pools:       LiquidityPool[];
  sweeps:      LiquiditySweep[];
  inducements: any[];
  bslSweep:    boolean;
  sslSweep:    boolean;
  bslPrice:    number | null;
  sslPrice:    number | null;
  score:       number;
}

function findEqualLevels(swings: Swing[], type: 'HI'|'LO', tol: number): LiquidityPool[] {
  const filtered = swings.filter(s => s.type === type);
  const clusters: LiquidityPool[] = [];
  const used = new Set<number>();
  for (let i = 0; i < filtered.length; i++) {
    if (used.has(i)) continue;
    const cluster = [filtered[i]];
    for (let j = i + 1; j < filtered.length; j++) {
      if (!used.has(j) && Math.abs(filtered[i].price - filtered[j].price) <= tol) {
        cluster.push(filtered[j]); used.add(j);
      }
    }
    if (cluster.length >= 2) {
      const avg = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      clusters.push({
        price: avg, type,
        touches: cluster.length,
        firstTime: cluster[0].time, lastTime: cluster[cluster.length-1].time,
        loadedness: cluster.length >= 3 ? 'LOADED' : 'PRIMED',
        sweepProbability: 0, ageMs: 0, strength: Math.min(100, cluster.length * 25 + 20),
      });
    }
    used.add(i);
  }
  return clusters;
}

function detectSweeps(candles: Candle[], levels: LiquidityPool[], atr: number): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const buffer = atr * 0.08;
  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    for (const lvl of levels) {
      if (lvl.type === 'LO' && c.low < lvl.price - buffer && c.close > lvl.price)
        sweeps.push({ type: 'SWEEP_BULL', level: lvl, time: c.time, idx: i, wickDepth: lvl.price - c.low, recovery: c.close - lvl.price });
      if (lvl.type === 'HI' && c.high > lvl.price + buffer && c.close < lvl.price)
        sweeps.push({ type: 'SWEEP_BEAR', level: lvl, time: c.time, idx: i, wickDepth: c.high - lvl.price, recovery: lvl.price - c.close });
    }
  }
  return sweeps.slice(-8);
}

export class LiquidityEngine {
  run(candles: Candle[], swings: Swing[], trend: string, atr: number): LiquidityResult {
    const tol = atr * 0.15;
    const now = Date.now();
    const eqh = findEqualLevels(swings, 'HI', tol);
    const eql = findEqualLevels(swings, 'LO', tol);
    const all = [...eqh, ...eql];
    for (const lvl of all) {
      const ftMs = lvl.firstTime > 1e10 ? lvl.firstTime : lvl.firstTime * 1000;
      lvl.ageMs = now - ftMs;
      // Sweep probability
      let p = 0.30;
      p += Math.min(0.25, lvl.touches * 0.08);
      if (lvl.loadedness === 'LOADED') p += 0.20;
      if (trend === 'BULLISH'  && lvl.type === 'HI') p += 0.10;
      if (trend === 'BEARISH'  && lvl.type === 'LO') p += 0.10;
      if (lvl.ageMs > 30 * 86_400_000) p -= 0.10;
      lvl.sweepProbability = Math.min(0.99, Math.max(0.05, +p.toFixed(2)));
    }
    const sweeps     = detectSweeps(candles, all, atr);
    const bslSweep   = sweeps.some(s => s.type === 'SWEEP_BULL');
    const sslSweep   = sweeps.some(s => s.type === 'SWEEP_BEAR');
    const bslPrice   = sweeps.find(s => s.type === 'SWEEP_BULL')?.level.price ?? null;
    const sslPrice   = sweeps.find(s => s.type === 'SWEEP_BEAR')?.level.price ?? null;
    // Score: 5 pts per pool (capped 15) + 10 per sweep (capped 15)
    const score = Math.min(15, all.length * 5) + Math.min(15, sweeps.length * 10);
    return { eqh, eql, pools: all, sweeps, inducements: [], bslSweep, sslSweep, bslPrice, sslPrice, score };
  }
}
