/**
 * Nexus V30 — Frontend-only types
 * Business types come from @nexus-v30/shared-types.
 * This file holds UI-only type definitions.
 */
export type Page = 'dashboard' | 'signals' | 'scanner' | 'execution' | 'journal' | 'ai-assistant' | 'calendar' | 'settings';

export interface Notification {
  id:      string;
  type:    'success' | 'error' | 'warning' | 'info';
  title:   string;
  message: string;
  ts:      number;
}

export interface ChartOverlays {
  sr:       boolean;  // support/resistance
  ob:       boolean;  // order blocks
  fvg:      boolean;  // fair value gaps
  liq:      boolean;  // liquidity levels
  vwap:     boolean;
  choch:    boolean;
  sessions: boolean;
}
