/**
 * @nexus-v30/shared-types — Engine Types
 *
 * Sanitised subset of engine output types safe for client consumption.
 * These match the shapes that EngineService._sanitise() produces.
 * Internal engine state, scoring weights, and algorithms are NOT here.
 */

export type Bias = 'BULL' | 'BEAR' | 'NEUTRAL' | 'WAIT';
export type Mode = 'scalp' | 'intraday' | 'positional';
export type SessionName = 'LONDON' | 'NEW YORK' | 'LONDON/NY' | 'ASIA' | 'SYDNEY' | 'OFF';

export interface SignalResult {
  bias:       Bias;
  entry:      number | null;
  sl:         number | null;
  tp1:        number | null;
  rr:         string | null;
  conviction: number;    // 0–100
  setup:      string | null;
}

export interface ConfluenceResult {
  total:      number;
  structure:  number;
  mtf:        number;
  liquidity:  number;
  orderBlock: number;
  fvg:        number;
  session:    number;
}

export interface StructureResult {
  trend:    'BULLISH' | 'BEARISH' | 'RANGING' | 'UNKNOWN';
  regime:   'TRENDING' | 'REVERSAL_WATCH' | 'RANGING' | 'UNKNOWN';
  hasBos:   boolean;
  hasChoch: boolean;
}

export interface LevelResult {
  resistance: number | null;
  support:    number | null;
  obHigh:     number | null;
  obLow:      number | null;
  fvgHigh:    number | null;
  fvgLow:     number | null;
}


// ── Institutional profile gate annotation ─────────────────────────────
export type AnalysisProfile = 'retail' | 'institutional';

export interface InstitutionalGates {
  confluencePassed: boolean;
  rrPassed:         boolean;
  sessionPassed:    boolean;
  mtfPassed:        boolean;
  regimePassed:     boolean;
  allPassed:        boolean;
}

export interface InstitutionalAnnotation {
  profile:           'institutional';
  confGate:          number;
  rrFloor:           string;
  sessionGate:       boolean;
  mtfConfirmed:      boolean;
  regimeBlocked:     boolean;
  sharpeProxyOk:     boolean;
  expectancyNote:    string;
  riskAdjConviction: number;
  gates:             InstitutionalGates;
}

export interface EngineAnalysisResult {
  sym:        string;
  tf:         number;
  mode:       Mode;
  profile:    AnalysisProfile;
  price:      number;
  signal:     SignalResult;
  confluence: ConfluenceResult;
  structure:  StructureResult;
  levels:     LevelResult;
  session:    string;
  reasoning:  string;
  computedAt:    number;
  institutional: InstitutionalAnnotation | null;
}

export interface ScanResult {
  sym:        string;
  tf:         number;
  ok:         boolean;
  analysis:   EngineAnalysisResult | null;
  error:      string | null;
}

export interface OhlcvCandle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}
