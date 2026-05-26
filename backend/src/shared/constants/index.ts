/**
 * Nexus V30 — Shared Constants
 *
 * All magic numbers and configuration constants in one place.
 * Reference these — never hardcode values in services or engines.
 */

// ── Security — single source of truth for JWT config ─────────────────
export const JWT_SECRET  = process.env.JWT_SECRET  ?? 'dev_secret_min_32_chars_change_me';
export const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d';

// ── Instruments ───────────────────────────────────────────────────────
export const VALID_SYMBOLS = [
  // Metals
  'XAUUSD', 'XAGUSD',
  // Forex
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'GBPJPY',
  // Crypto
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD',
  // Oil
  'USOIL', 'UKOIL',
  // Indices
  'US30', 'US500', 'NAS100',
] as const;
export type ValidSymbol = typeof VALID_SYMBOLS[number];

export const VALID_TIMEFRAMES = [1, 5, 15, 30, 60, 240, 1440] as const;

export const VALID_MODES = ['scalp', 'intraday', 'positional'] as const;

// ── Rate limits (requests per window) ─────────────────────────────────
export const RATE_LIMITS = {
  AUTH_MAX:    20,
  AUTH_WINDOW: 15 * 60 * 1000,
  API_MAX:     200,
  API_WINDOW:  60 * 1000,
  HEAVY_MAX:   30,
  HEAVY_WINDOW:60 * 1000,
  AI_MAX:      10,
  AI_WINDOW:   60 * 1000,
} as const;

// ── Engine thresholds ─────────────────────────────────────────────────
export const ENGINE = {
  MIN_CANDLES:         50,
  ATR_PERIOD:          14,
  DISPLACEMENT_MULT:   1.5,
  SCALP_DISP_MULT:     0.8,
  MAX_OB_LOOKBACK:     100,
  MAX_FVG_LOOKBACK:    50,
  REVERSAL_WATCH_CAP:  70,
} as const;

// ── Confluence weights ────────────────────────────────────────────────
export const CONFLUENCE_WEIGHTS = {
  STRUCTURE:   25,
  MTF:         20,
  LIQUIDITY:   15,
  ORDER_BLOCK: 20,
  FVG:         15,
  SESSION:      5,
} as const;

export const CONFLUENCE_TOTAL_MAX = Object.values(CONFLUENCE_WEIGHTS)
  .reduce((s, v) => s + v, 0);

// ── Signal conviction thresholds ──────────────────────────────────────
export const CONVICTION = {
  SCALP:      { min: 55, strong: 70 },
  INTRADAY:   { min: 65, strong: 78 },
  POSITIONAL: { min: 72, strong: 85 },
} as const;

// ── Cache TTLs (seconds) ──────────────────────────────────────────────
export const CACHE_TTL = {
  PRICE:      10,
  CANDLES:    30,
  SESSION:    60,
  CALENDAR:   300,
  WATCHLIST:  15,
} as const;

export const WORKER_CONCURRENCY = {
  CANDLE:    5,
  SIGNAL:    2,
  ALERT:     10,
  AI:        3,
  ANALYTICS: 1,
} as const;

// ── WebSocket ─────────────────────────────────────────────────────────
export const WS = {
  PRICE_BROADCAST_INTERVAL_MS: 2_000,
  MAX_RECONNECT_DELAY_MS:      30_000,
  RECONNECT_BASE_DELAY_MS:     1_000,
} as const;
