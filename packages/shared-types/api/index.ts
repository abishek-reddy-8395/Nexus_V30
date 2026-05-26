import type { OhlcvCandle } from '../engine/index';
/**
 * @nexus-v30/shared-types — REST API Response Contracts
 *
 * Typed response shapes for every API endpoint.
 * Both backend (route handlers) and frontend (api.client.ts) import from here.
 * Contracts are negotiated here — never assumed from implementation.
 */

import type { EngineAnalysisResult, ScanResult } from '../engine/index';
import type { AiNarrativeOutput, AiWarRoomOutput, AiPromptOutput } from '../ai/index';

// ── Standard envelope ──────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  ts:   number;
}

export interface ApiError {
  error:  string;
  code:   string;
  status: number;
  ts:     number;
}

// ── Auth ──────────────────────────────────────────────────────────────
export interface AuthUser {
  id:       string;
  email:    string;
  name:     string;
  tenantId: string;
  plan:     'free' | 'pro' | 'enterprise';
  role:     'owner' | 'admin' | 'member' | 'viewer';
}

export interface AuthLoginResponse {
  token:        string;
  refreshToken: string;
  user:         AuthUser;
}

// ── Market ────────────────────────────────────────────────────────────

export interface MarketPriceResponse {
  sym:          string;
  price:        number;
  change:       number;
  changePct:    number;
  candles:      OhlcvCandle[];
  dailyCandles: OhlcvCandle[];
  fetchedAt:    number;
}

export interface WatchlistResponse {
  items: Array<{ sym: string; price: number; change: number; changePct: number }>;
}

// ── Engine ────────────────────────────────────────────────────────────
export interface EngineAnalyzeResponse extends EngineAnalysisResult {
  price: number;
}

export interface EngineScanResponse {
  results:    ScanResult[];
  scannedAt:  number;
  summary: {
    bull:    number;
    bear:    number;
    neutral: number;
    failed:  number;
  };
}

// ── Risk ──────────────────────────────────────────────────────────────
export interface RiskCalculateResponse {
  sym:            string;
  riskAmt:        number;
  riskPct:        number;
  lots:           number;
  positionSize:   number;
  slDist:         number;
  slPips:         number;
  tpDist:         number | null;
  rr:             string | null;
  potentialProfit:number | null;
  pipValue:       number;
  lotFillPct:     number;
  warnings:       string[];
}

export interface RiskValidateResponse {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Journal ───────────────────────────────────────────────────────────
export interface JournalEntry {
  id:             string;
  sym:            string;
  dir:            'BUY' | 'SELL';
  mode:           string;
  entry:          number | null;
  sl:             number | null;
  tp1:            number | null;
  rr:             string | null;
  conviction:     number | null;
  result:         'win' | 'loss' | 'be' | null;
  pnl:            number | null;
  notes:          string | null;
  tags:           string[];
  confluenceScore:number | null;
  ts:             string;
  tsStr:          string;
}

export interface JournalListResponse {
  entries: JournalEntry[];
  count:   number;
}

export interface JournalStats {
  total:        number;
  wins:         number;
  losses:       number;
  be:           number;
  winRate:      number;
  totalPnl:     number;
  avgPnl:       number;
  expectancy:   number;
  profitFactor: number;
  bestStreak:   number;
  worstStreak:  number;
  avgConviction:number;
}

// ── Session ───────────────────────────────────────────────────────────
export interface SessionResponse {
  name:       string;
  weight:     number;
  vol:        string;
  killzone:   boolean;
  overlap:    boolean;
  inKillzone: boolean;
  kzName:     string | null;
  utcHour:    number;
  utcTime:    string;
}

export interface ClockResponse {
  utc:         string;
  dayProgress: number;
  session:     string;
  timestamp:   string;
}

// ── AI ────────────────────────────────────────────────────────────────
export type { AiNarrativeOutput, AiWarRoomOutput, AiPromptOutput };

// ── Alerts ────────────────────────────────────────────────────────────
export interface Alert {
  id:          string;
  sym:         string;
  type:        'price' | 'signal' | 'confluence';
  condition:   Record<string, unknown>;
  active:      boolean;
  triggered:   boolean;
  triggeredAt: string | null;
  createdAt:   string;
}

// ── Scanner ───────────────────────────────────────────────────────────
export type { ScanResult };



