/**
 * Nexus V30 — Frontend Constants
 * Expanded instrument list for enterprise/prop firm positioning
 */

export const INSTRUMENTS = [
  // Metals
  'XAUUSD', 'XAGUSD',
  // Forex majors
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'GBPJPY',
  // Crypto
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD',
  // Oil
  'USOIL', 'UKOIL',
  // Indices
  'US30', 'US500', 'NAS100',
] as const;

export type Instrument = typeof INSTRUMENTS[number];

export const INSTRUMENT_GROUPS = {
  Metals:  ['XAUUSD', 'XAGUSD'],
  Forex:   ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'GBPJPY'],
  Crypto:  ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD'],
  Oil:     ['USOIL', 'UKOIL'],
  Indices: ['US30', 'US500', 'NAS100'],
} as const;

export const TIMEFRAMES = [
  { label: 'M1',  value: 1    },
  { label: 'M5',  value: 5    },
  { label: 'M15', value: 15   },
  { label: 'M30', value: 30   },
  { label: 'H1',  value: 60   },
  { label: 'H4',  value: 240  },
  { label: 'D',   value: 1440 },
] as const;

export const TRADING_MODES = ['scalp', 'intraday', 'positional'] as const;
export type TradingMode = typeof TRADING_MODES[number];

export const BIAS_COLORS = {
  BULL:    'var(--green)',
  BEAR:    'var(--red)',
  NEUTRAL: 'var(--muted)',
  WAIT:    'var(--muted)',
} as const;

export const SESSION_COLORS = {
  SYDNEY:         '#7c6f64',
  ASIA:           '#458588',
  TOKYO:          '#458588',
  LONDON:         '#689d6a',
  'NEW YORK':     '#d79921',
  'LONDON/NY':    '#d65d0e',
  'LONDON/NY OVERLAP': '#d65d0e',
  OFF:            '#3c3836',
  'INTER-SESSION':'#3c3836',
} as const;

export const SCAN_FILTERS = ['all', 'crypto', 'forex', 'metals', 'indices', 'bull', 'bear'] as const;
