/**
 * Nexus V30 — Replay Engine Determinism Tests
 *
 * Validates that the replay engine produces identical signal sequences
 * for identical input — essential for backtesting validity.
 */

import { ReplayEngine } from '../engines/replay-engine/index';

function makeCandles(count: number, seed = 42): any[] {
  let v = seed;
  const lcg = () => { v = (v * 1664525 + 1013904223) & 0xffffffff; return (v >>> 0) / 0xffffffff; };
  return Array.from({ length: count }, (_, i) => {
    const close = 2000 + lcg() * 100 - 50;
    const range = lcg() * 10 + 2;
    return {
      time:   1700000000 + i * 900,
      open:   close - range * 0.3,
      high:   close + range * 0.7,
      low:    close - range * 0.3 - range * 0.7,
      close,
      volume: 500 + lcg() * 1000,
    };
  });
}

describe('ReplayEngine', () => {
  const engine      = new ReplayEngine();
  const candles     = makeCandles(120, 42);
  const daily       = makeCandles(30, 7);
  const baseInput   = { candles, dailyCandles: daily, sym: 'XAUUSD', tf: 15, mode: 'intraday' as const, tenantId: 'test' };

  it('runs without throwing on valid input', async () => {
    await expect(engine.run(baseInput)).resolves.toBeDefined();
  });

  it('throws 422 with insufficient candles', async () => {
    await expect(engine.run({ ...baseInput, candles: candles.slice(0, 10) }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('result has correct shape', async () => {
    const result = await engine.run(baseInput);
    expect(result).toHaveProperty('sym', 'XAUUSD');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('bullSignals');
    expect(result.summary).toHaveProperty('bearSignals');
    expect(result.summary).toHaveProperty('avgConfluence');
    expect(result.stepsRun).toBeGreaterThan(0);
  });

  it('is deterministic across two runs with identical input', async () => {
    const r1 = await engine.run(baseInput);
    const r2 = await engine.run(baseInput);
    expect(r1.stepsRun).toBe(r2.stepsRun);
    for (let i = 0; i < Math.min(r1.signals.length, r2.signals.length); i++) {
      expect(r1.signals[i].bias).toBe(r2.signals[i].bias);
      expect(r1.signals[i].conviction).toBe(r2.signals[i].conviction);
    }
  });

  it('assertDeterministic returns true for clean engine run', async () => {
    const { deterministic } = await engine.assertDeterministic(baseInput);
    expect(deterministic).toBe(true);
  });

  it('summary counts add up correctly', async () => {
    const result = await engine.run(baseInput);
    const { bullSignals, bearSignals, waitSignals } = result.summary;
    expect(bullSignals + bearSignals + waitSignals).toBe(result.stepsRun);
  });
});
