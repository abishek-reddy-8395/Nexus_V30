/**
 * Nexus V30 — Market Structure Engine
 * Ported from v2 Engine.js StructureEngine.
 * Server-side only. Dual-pass swing scan [S1], incremental state [I1].
 */

import { ENGINE } from '../../shared/constants/index';

export interface Candle { time: number; open: number; high: number; low: number; close: number; volume?: number; }
export interface Swing { type: 'HI'|'LO'; price: number; time: number; idx: number; isMicro: boolean; }
export interface StructureLabel { type: 'HH'|'HL'|'LH'|'LL'; price: number; time: number; idx: number; }
export interface StructureEvent { type: 'BOS_BULL'|'BOS_BEAR'|'CHOCH_BULL'|'CHOCH_BEAR'; price: number; time: number; idx: number; displacement: number; qualityScore: number; isMicro: boolean; }
export interface Displacement { time: number; idx: number; direction: 'BULL'|'BEAR'; bodySize: number; isMicro: boolean; }

export interface StructureResult {
  swings:        Swing[];
  microSwings:   Swing[];
  labels:        StructureLabel[];
  trend:         'BULLISH'|'BEARISH'|'RANGING'|'UNKNOWN';
  events:        StructureEvent[];
  displacements: Displacement[];
  hasBos:        boolean;
  hasChoch:      boolean;
  atr:           number;
}

// Per-storeKey incremental state [I1]
interface StructureStore {
  swings: Swing[]; microSwings: Swing[]; allSwings: Swing[];
  labels: StructureLabel[]; events: StructureEvent[]; displacements: Displacement[];
  lastIdx: number; lastDispIdx: number; atr: number;
}
const _stateStore = new Map<string, StructureStore>();

function _getStore(key: string): StructureStore {
  if (!_stateStore.has(key)) {
    _stateStore.set(key, { swings: [], microSwings: [], allSwings: [], labels: [], events: [], displacements: [], lastIdx: 0, lastDispIdx: 0, atr: 0 });
  }
  return _stateStore.get(key)!;
}

// [F6] Adaptive strength based on candle count
function adaptiveStrength(len: number): number {
  if (len >= 300) return 5;
  if (len >= 150) return 4;
  return 3;
}

function computeATR(candles: Candle[], n = 20): number {
  const slice = candles.slice(-n);
  let sum = 0;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i], prev = slice[i - 1];
    const hl = c.high - c.low;
    sum += prev ? Math.max(hl, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)) : hl;
  }
  return sum / slice.length;
}

// [S1] Detect swing highs/lows with given left/right strength
function detectSwings(candles: Candle[], strength: number, isMicro: boolean): Swing[] {
  const swings: Swing[] = [];
  if (candles.length < strength * 2 + 1) return swings;
  for (let i = strength; i < candles.length - strength; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i].high <= candles[i-j].high || candles[i].high <= candles[i+j].high) isH = false;
      if (candles[i].low  >= candles[i-j].low  || candles[i].low  >= candles[i+j].low)  isL = false;
    }
    if (isH) swings.push({ type: 'HI', price: candles[i].high, time: candles[i].time, idx: i, isMicro });
    if (isL) swings.push({ type: 'LO', price: candles[i].low,  time: candles[i].time, idx: i, isMicro });
  }
  return swings.sort((a, b) => a.idx - b.idx);
}

function classifyStructure(swings: Swing[]): { labels: StructureLabel[]; trend: StructureResult['trend'] } {
  const highs = swings.filter(s => s.type === 'HI');
  const lows  = swings.filter(s => s.type === 'LO');
  const labels: StructureLabel[] = [];
  for (let i = 1; i < highs.length; i++)
    labels.push({ type: highs[i].price > highs[i-1].price ? 'HH' : 'LH', price: highs[i].price, time: highs[i].time, idx: highs[i].idx });
  for (let i = 1; i < lows.length; i++)
    labels.push({ type: lows[i].price > lows[i-1].price ? 'HL' : 'LL', price: lows[i].price, time: lows[i].time, idx: lows[i].idx });
  labels.sort((a, b) => a.idx - b.idx);
  const last4 = labels.slice(-4);
  let trend: StructureResult['trend'] = 'RANGING';
  if (last4.filter(l => l.type === 'HH').length >= 2 && last4.filter(l => l.type === 'HL').length >= 1) trend = 'BULLISH';
  else if (last4.filter(l => l.type === 'LL').length >= 2 && last4.filter(l => l.type === 'LH').length >= 1) trend = 'BEARISH';
  return { labels, trend };
}

function detectBOSandCHoCH(candles: Candle[], swings: Swing[], atr: number): StructureEvent[] {
  const events: StructureEvent[] = [];
  const highs = swings.filter(s => s.type === 'HI');
  const lows  = swings.filter(s => s.type === 'LO');
  const dupTol = atr * 0.05;
  const isDup = (price: number, dir: string) => events.some(e => e.type.includes(dir) && Math.abs(e.price - price) < dupTol);
  let hPtr = 0, lPtr = 0;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    while (hPtr < highs.length && highs[hPtr].idx < i) hPtr++;
    while (lPtr < lows.length  && lows[lPtr].idx  < i) lPtr++;
    const relevantHighs = highs.slice(Math.max(0, hPtr - 10), hPtr);
    const relevantLows  = lows.slice(Math.max(0, lPtr - 10),  lPtr);
    for (const sh of relevantHighs) {
      if (c.close > sh.price && !isDup(sh.price, 'BULL')) {
        const shPos  = highs.indexOf(sh);
        const priorH = shPos > 0 ? highs.slice(Math.max(0, shPos - 5), shPos).filter(h => h.idx > sh.idx - 20) : [];
        const wasBear = priorH.length >= 2 && priorH[priorH.length-1].price < priorH[priorH.length-2].price;
        const score = Math.min(100, Math.round(((c.close - sh.price) / Math.max(atr, 1e-8)) * 40));
        events.push({ type: wasBear ? 'CHOCH_BULL' : 'BOS_BULL', price: sh.price, time: c.time, idx: i, displacement: c.close - sh.price, qualityScore: score, isMicro: sh.isMicro });
        break;
      }
    }
    for (const sl of relevantLows) {
      if (c.close < sl.price && !isDup(sl.price, 'BEAR')) {
        const slPos  = lows.indexOf(sl);
        const priorL = slPos > 0 ? lows.slice(Math.max(0, slPos - 5), slPos).filter(l => l.idx > sl.idx - 20) : [];
        const wasBull = priorL.length >= 2 && priorL[priorL.length-1].price > priorL[priorL.length-2].price;
        const score = Math.min(100, Math.round(((sl.price - c.close) / Math.max(atr, 1e-8)) * 40));
        events.push({ type: wasBull ? 'CHOCH_BEAR' : 'BOS_BEAR', price: sl.price, time: c.time, idx: i, displacement: sl.price - c.close, qualityScore: score, isMicro: sl.isMicro });
        break;
      }
    }
  }
  return events.slice(-12);
}

export class StructureEngine {
  run(candles: Candle[], storeKey: string, enableMicro = true): StructureResult {
    if (!candles || candles.length < 10) {
      return { swings: [], microSwings: [], labels: [], trend: 'UNKNOWN', events: [], displacements: [], hasBos: false, hasChoch: false, atr: 0 };
    }
    const store = _getStore(storeKey);
    const atr   = computeATR(candles);
    store.atr   = atr;

    const stdStrength = adaptiveStrength(candles.length);
    const lookback    = stdStrength * 2 + 2;
    const scanFrom    = Math.max(0, store.lastIdx - lookback);
    const slice       = candles.slice(scanFrom);

    // Standard swings — re-anchor indices to full array
    const newStd = detectSwings(slice, stdStrength, false).map(s => ({ ...s, idx: s.idx + scanFrom }));

    // [S1] Micro swings
    const newMicro = enableMicro
      ? detectSwings(slice, 1, true).map(s => ({ ...s, idx: s.idx + scanFrom }))
      : [];

    // Merge + cap [FIX-MEMORY]
    const MAX_SWING = 500;
    store.swings      = [...store.swings.filter(s => s.idx < scanFrom), ...newStd].slice(-MAX_SWING);
    store.microSwings = [...store.microSwings.filter(s => s.idx < scanFrom), ...newMicro].slice(-MAX_SWING);
    const prevAll = (store.allSwings || []).filter(s => s.idx < scanFrom);
    store.allSwings   = [...prevAll, ...newStd, ...newMicro].sort((a, b) => a.idx - b.idx).slice(-1000);

    const { labels, trend } = classifyStructure(store.swings);
    store.labels = labels;

    const events = detectBOSandCHoCH(candles, store.allSwings, atr);
    store.events = events;

    // Displacements [FIX-INCREMENTAL]
    const macroThr = atr * 1.5, microThr = atr * 0.8;
    const dispFrom = Math.max(1, store.lastDispIdx);
    const newDisp: Displacement[] = [];
    for (let i = dispFrom; i < candles.length; i++) {
      const c = candles[i], body = Math.abs(c.close - c.open);
      if (body >= macroThr) newDisp.push({ time: c.time, idx: i, direction: c.close > c.open ? 'BULL' : 'BEAR', bodySize: body, isMicro: false });
      else if (enableMicro && body >= microThr) newDisp.push({ time: c.time, idx: i, direction: c.close > c.open ? 'BULL' : 'BEAR', bodySize: body, isMicro: true });
    }
    store.displacements = [...store.displacements, ...newDisp].slice(-20);
    store.lastDispIdx = candles.length;
    store.lastIdx     = candles.length;

    const hasBos   = events.some(e => e.type.startsWith('BOS'));
    const hasChoch  = events.some(e => e.type.startsWith('CHOCH'));

    return { swings: store.swings, microSwings: store.microSwings, labels, trend, events, displacements: store.displacements, hasBos, hasChoch, atr };
  }

  static resetStore(key: string) { _stateStore.delete(key); }
}
