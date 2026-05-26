/**
 * Nexus V30 — Engine Contracts
 *
 * Shared type contracts for all engine modules.
 * Imported by: EngineService, all engine sub-modules, scan workers.
 * NOT exported to frontend — types used in packages/shared-types are
 * the sanitised subset safe for client consumption.
 */

export interface OhlcvCandle {
  time:   number; // Unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface EngineInput {
  candles:      OhlcvCandle[];
  dailyCandles: OhlcvCandle[];
  storeKey:     string;
  mode:         'scalp' | 'intraday' | 'positional';
  tfMinutes:    number;
}

export interface EngineOutput {
  signal:     SignalOutput;
  confluence: ConfluenceOutput;
  structure:  StructureOutput;
  liquidity:  LiquidityOutput;
  orderBlocks: OrderBlockOutput[];
  fvgs:       FvgOutput[];
  session:    SessionOutput;
  regime:     RegimeOutput;
  reasoning:  string;
  computedAt: number;
}

export interface SignalOutput {
  bias:       'BULL' | 'BEAR' | 'NEUTRAL' | 'WAIT';
  entry:      number | null;
  sl:         number | null;
  tp1:        number | null;
  tp2:        number | null;
  rr:         string | null;
  conviction: number;           // 0–100
  setup:      string | null;
}

export interface ConfluenceOutput {
  total:      number;           // 0–100 composite
  structure:  number;
  mtf:        number;
  liquidity:  number;
  orderBlock: number;
  fvg:        number;
  session:    number;
  divergence: number;
}

export interface StructureOutput {
  trend:   'BULLISH' | 'BEARISH' | 'RANGING' | 'UNKNOWN';
  regime:  'TRENDING' | 'REVERSAL_WATCH' | 'RANGING' | 'UNKNOWN';
  hasBos:  boolean;
  hasChoch:boolean;
}

export interface LiquidityOutput {
  bslSweep:  boolean;
  sslSweep:  boolean;
  bslLevel:  number | null;
  sslLevel:  number | null;
  eqh:       number[];
  eql:       number[];
}

export interface OrderBlockOutput {
  high:    number;
  low:     number;
  type:    'BULL' | 'BEAR';
  fresh:   boolean;
  mitigated: boolean;
  strength: number;
}

export interface FvgOutput {
  high:    number;
  low:     number;
  type:    'BULL' | 'BEAR';
  filled:  boolean;
  time:    number;
}

export interface SessionOutput {
  name:       string;
  inKillzone: boolean;
  kzName:     string | null;
  weight:     number;
}

export interface RegimeOutput {
  label:      string;
  conviction: number;
}
