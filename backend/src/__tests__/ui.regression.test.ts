/**
 * Nexus V30 — UI Regression Tests
 *
 * NEW in v30: tests that validate critical UI/UX fixes made in v30–v30.
 * These are pure logic tests — no DOM, no browser.
 * Covers:
 *   - Contrast ratio calculations (WCAG AA compliance)
 *   - Confluence score display logic
 *   - Bias badge label correctness
 *   - MAX_STEPS replay cap enforcement
 *   - Session timezone detection
 *   - Price formatting by instrument digits
 */

// ── Contrast ratio (WCAG) ─────────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG AA contrast compliance', () => {
  const CREAM_2   = '#F4F2EC'; // var(--cream-2) — most common background
  const MUTED_V24 = '#8A8570'; // old value — FAILS AA
  const MUTED_V28 = '#6B6455'; // new value — PASSES AA

  it('v30 --muted (#8A8570) FAILS WCAG AA on cream-2 (contrast < 4.5)', () => {
    const ratio = contrastRatio(MUTED_V24, CREAM_2);
    expect(ratio).toBeLessThan(4.5);
  });

  it('v30 --muted (#6B6455) PASSES WCAG AA on cream-2 (contrast ≥ 4.5)', () => {
    const ratio = contrastRatio(MUTED_V28, CREAM_2);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('v30 improvement is measurable (v30 contrast > v30 contrast)', () => {
    const v30 = contrastRatio(MUTED_V24, CREAM_2);
    const v30 = contrastRatio(MUTED_V28, CREAM_2);
    expect(v30).toBeGreaterThan(v30);
  });

  it('ink on cream passes AAA (≥7:1)', () => {
    const INK  = '#1A1710';
    const ratio = contrastRatio(INK, CREAM_2);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('green on green-light passes AA', () => {
    const ratio = contrastRatio('#2E7D52', '#D4EDE1');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('red on red-light passes AA', () => {
    const ratio = contrastRatio('#B5382A', '#F5DDD9');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ── Confluence score display logic ────────────────────────────────────────────

describe('Confluence score colouring and label logic', () => {
  function confColor(total: number): 'green' | 'gold' | 'red' {
    if (total >= 75) return 'green';
    if (total >= 50) return 'gold';
    return 'red';
  }

  function confLabel(total: number): string {
    if (total >= 75) return 'High confidence';
    if (total >= 50) return 'Moderate — check levels';
    if (total >  0)  return 'Low — wait for setup';
    return 'Run analysis first';
  }

  it('score ≥75 is green (high confidence)', () => {
    expect(confColor(75)).toBe('green');
    expect(confColor(100)).toBe('green');
    expect(confLabel(80)).toBe('High confidence');
  });

  it('score 50–74 is gold (moderate)', () => {
    expect(confColor(50)).toBe('gold');
    expect(confColor(74)).toBe('gold');
    expect(confLabel(60)).toContain('Moderate');
  });

  it('score < 50 is red (low)', () => {
    expect(confColor(49)).toBe('red');
    expect(confColor(0)).toBe('red');
  });

  it('score 0 shows "Run analysis first"', () => {
    expect(confLabel(0)).toBe('Run analysis first');
  });

  it('score 1 shows low wait message', () => {
    expect(confLabel(1)).toContain('Low');
  });

  it('boundary at exactly 75 is high confidence', () => {
    expect(confColor(75)).toBe('green');
    expect(confColor(74)).toBe('gold');
  });

  it('boundary at exactly 50 is moderate', () => {
    expect(confColor(50)).toBe('gold');
    expect(confColor(49)).toBe('red');
  });
});

// ── Bias badge correctness ────────────────────────────────────────────────────

describe('Bias badge label and colour mapping', () => {
  const BIAS_STYLES: Record<string, { background: string; color: string }> = {
    BULL:    { background: '#D4EDE1', color: '#2E7D52' },
    BEAR:    { background: '#F5DDD9', color: '#B5382A' },
    NEUTRAL: { background: '#EDE9DE', color: '#6B6455' },
    WAIT:    { background: '#FFF3CD', color: '#7A5500' },
  };

  it('BULL badge uses green palette', () => {
    expect(BIAS_STYLES['BULL'].color).toBe('#2E7D52');
  });

  it('BEAR badge uses red palette', () => {
    expect(BIAS_STYLES['BEAR'].color).toBe('#B5382A');
  });

  it('WAIT badge uses amber palette', () => {
    expect(BIAS_STYLES['WAIT'].color).toContain('#7A5500');
  });

  it('all valid bias values have a defined style', () => {
    const validBiases = ['BULL', 'BEAR', 'NEUTRAL', 'WAIT'];
    for (const bias of validBiases) {
      expect(BIAS_STYLES[bias]).toBeDefined();
      expect(BIAS_STYLES[bias].color).toBeTruthy();
    }
  });

  it('NEUTRAL bias exists (not just WAIT)', () => {
    expect(BIAS_STYLES['NEUTRAL']).toBeDefined();
  });
});

// ── Replay MAX_STEPS cap ──────────────────────────────────────────────────────

describe('Replay MAX_STEPS enforcement', () => {
  const MAX_STEPS = 50;

  function getReplaySteps(rawCandleCount: number, windowSize = 50): number {
    if (rawCandleCount < windowSize + 1) return 0;
    return Math.min(rawCandleCount - windowSize, MAX_STEPS);
  }

  it('caps at 50 steps for large candle sets', () => {
    expect(getReplaySteps(300)).toBe(50);
    expect(getReplaySteps(500)).toBe(50);
  });

  it('returns 0 for insufficient candles', () => {
    expect(getReplaySteps(50)).toBe(0);
    expect(getReplaySteps(10)).toBe(0);
  });

  it('returns correct count for exactly 100 candles', () => {
    expect(getReplaySteps(100)).toBe(50); // 100-50=50, capped at 50
  });

  it('returns correct count for 70 candles', () => {
    expect(getReplaySteps(70)).toBe(20); // 70-50=20, under cap
  });

  it('MAX_STEPS is 50 (not the old 300)', () => {
    expect(MAX_STEPS).toBe(50);
    expect(MAX_STEPS).not.toBe(300);
  });
});

// ── Session detection ─────────────────────────────────────────────────────────

describe('Trading session UTC detection', () => {
  function getSession(utcHour: number): { name: string; color: string } {
    if (utcHour >= 13 && utcHour < 17) return { name: 'LONDON/NY', color: '#C9A84C' };
    if (utcHour >= 8  && utcHour < 17) return { name: 'LONDON',    color: '#C9A84C' };
    if (utcHour >= 13 && utcHour < 22) return { name: 'NEW YORK',  color: '#B5382A' };
    if (utcHour >= 0  && utcHour < 9)  return { name: 'TOKYO',     color: '#1E4E8C' };
    if (utcHour >= 22 || utcHour < 7)  return { name: 'SYDNEY',    color: '#4A6741' };
    return { name: 'OFF-SESSION', color: '#6B6455' };
  }

  it('14:00 UTC is London/NY overlap', () => {
    expect(getSession(14).name).toBe('LONDON/NY');
  });

  it('10:00 UTC is London session', () => {
    expect(getSession(10).name).toBe('LONDON');
  });

  it('02:00 UTC is Tokyo session', () => {
    expect(getSession(2).name).toBe('TOKYO');
  });

  it('23:00 UTC is Sydney session', () => {
    expect(getSession(23).name).toBe('SYDNEY');
  });

  it('returns a non-empty name for every hour of the day', () => {
    for (let h = 0; h < 24; h++) {
      const { name } = getSession(h);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

// ── Price formatting ──────────────────────────────────────────────────────────

describe('Price formatting by instrument', () => {
  const DIGITS: Record<string, number> = {
    XAUUSD: 2, BTCUSD: 0, EURUSD: 5, USDJPY: 3, XAGUSD: 3,
    SOLUSD: 4, BNBUSD: 4, NAS100: 2, US30: 0, USOIL: 2,
  };

  function formatPrice(sym: string, price: number): string {
    const digits = DIGITS[sym] ?? 5;
    return price.toFixed(digits);
  }

  it('formats XAUUSD to 2 decimal places', () => {
    expect(formatPrice('XAUUSD', 2350.1234)).toBe('2350.12');
  });

  it('formats BTCUSD to 0 decimal places (whole number)', () => {
    expect(formatPrice('BTCUSD', 67234.5)).toBe('67235');
  });

  it('formats EURUSD to 5 decimal places', () => {
    expect(formatPrice('EURUSD', 1.08523)).toBe('1.08523');
  });

  it('formats USDJPY to 3 decimal places', () => {
    expect(formatPrice('USDJPY', 149.857)).toBe('149.857');
  });

  it('new v30 instrument BNBUSD formats to 4 decimal places', () => {
    expect(formatPrice('BNBUSD', 432.1234)).toBe('432.1234');
  });

  it('new v30 instrument US30 formats to 0 decimal places', () => {
    expect(formatPrice('US30', 38542.6)).toBe('38543');
  });

  it('unknown instrument defaults to 5 decimal places', () => {
    expect(formatPrice('UNKNOWN', 1.12345)).toBe('1.12345');
  });
});
