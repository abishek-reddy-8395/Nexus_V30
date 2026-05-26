/**
 * Nexus V30 — Frontend Utilities
 */

/** Format a price to N decimal places */
export function fmt(value: number | null | undefined, digits = 5): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Format a dollar amount */
export function fmtUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a percentage */
export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

/** Bias → colour map */
export function biasColor(bias: string): string {
  const map: Record<string, string> = { BULL: '#1A9E6B', BEAR: '#C94040', WAIT: '#8B6914', NEUTRAL: '#6B5E52' };
  return map[bias] ?? '#6B5E52';
}

/** Debounce a function */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T;
}

/** Format unix timestamp to HH:MM */
export function fmtTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
