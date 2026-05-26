/**
 * Nexus V30 — Shared Enums
 *
 * Domain enums used across modules and engines.
 * Exported from here — never redefined in individual files.
 */

export enum Bias {
  BULL    = 'BULL',
  BEAR    = 'BEAR',
  NEUTRAL = 'NEUTRAL',
  WAIT    = 'WAIT',
}

export enum TradingMode {
  SCALP       = 'scalp',
  INTRADAY    = 'intraday',
  POSITIONAL  = 'positional',
}

export enum Direction {
  BUY  = 'BUY',
  SELL = 'SELL',
}

export enum TradeResult {
  WIN  = 'win',
  LOSS = 'loss',
  BE   = 'be',
}

export enum Plan {
  FREE       = 'free',
  PRO        = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum Role {
  OWNER  = 'owner',
  ADMIN  = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum Session {
  LONDON    = 'LONDON',
  NEW_YORK  = 'NEW YORK',
  LONDON_NY = 'LONDON/NY',
  ASIA      = 'ASIA',
  SYDNEY    = 'SYDNEY',
  OFF       = 'OFF',
}

export enum Regime {
  TRENDING        = 'TRENDING',
  REVERSAL_WATCH  = 'REVERSAL_WATCH',
  RANGING         = 'RANGING',
  UNKNOWN         = 'UNKNOWN',
}

export enum StructureTrend {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  RANGING = 'RANGING',
  UNKNOWN = 'UNKNOWN',
}

export enum AlertType {
  PRICE       = 'price',
  SIGNAL      = 'signal',
  CONFLUENCE  = 'confluence',
}

export enum NotificationChannel {
  EMAIL  = 'email',
  PUSH   = 'push',
  IN_APP = 'in_app',
}
