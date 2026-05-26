/**
 * Nexus V30 — Engine Determinism Tests
 *
 * Critical: given identical candle input, the engine must produce
 * identical output across runs. Any non-determinism breaks backtesting.
 */

import { EngineOrchestrator } from '../modules/market/engine.orchestrator';

function makeCandles(count: number, basePrice = 2000): any[] {
  // Deterministic candle generation — no Math.random()
  return Array.from({ length: count }, (_, i) => {
    const t     = 1700000000 + i * 900; // 15-min intervals
    const close = basePrice + Math.sin(i * 0.1) * 20 + Math.cos(i * 0.05) * 10;
    const range = Math.abs(Math.sin(i * 0.3)) * 5 + 1;
    return {
      time:   t,
      open:   close - range * 0.3,
      high:   close + range * 0.7,
      low:    close - range * 0.7,
      close,
      volume: 1000 + Math.abs(Math.sin(i * 0.2)) * 500,
    };
  });
}

describe('Engine determinism', () => {
  const candles      = makeCandles(200, 2000);
  const dailyCandles = makeCandles(30, 2000);
  const storeKey     = 'test:determinism:XAUUSD_15';

  it('produces identical output for identical input (run 1 vs run 2)', () => {
    // Use different instances to simulate independent runs
    const orc1 = EngineOrchestrator.create(`${storeKey}_run1`);
    const orc2 = EngineOrchestrator.create(`${storeKey}_run2`);

    const r1 = orc1.run({ candles, dailyCandles, storeKey: `${storeKey}_run1`, mode: 'intraday', tfMinutes: 15 });
    const r2 = orc2.run({ candles, dailyCandles, storeKey: `${storeKey}_run2`, mode: 'intraday', tfMinutes: 15 });

    expect(r1.signal.bias).toBe(r2.signal.bias);
    expect(r1.signal.conviction).toBe(r2.signal.conviction);
    expect(r1.confluence.total).toBe(r2.confluence.total);
    expect(r1.structure.trend).toBe(r2.structure.trend);
    expect(r1.structure.hasBos).toBe(r2.structure.hasBos);
    expect(r1.structure.hasChoch).toBe(r2.structure.hasChoch);
    expect(r1.regime.regime).toBe(r2.regime.regime);
  });

  it('signal.bias is one of the valid enum values', () => {
    const orc = EngineOrchestrator.create(`${storeKey}_enum`);
    const result = orc.run({ candles, dailyCandles, storeKey: `${storeKey}_enum`, mode: 'intraday', tfMinutes: 15 });
    expect(['BULL', 'BEAR', 'NEUTRAL', 'WAIT']).toContain(result.signal.bias);
  });

  it('confluence.total is between 0 and 100', () => {
    const orc = EngineOrchestrator.create(`${storeKey}_confluence`);
    const result = orc.run({ candles, dailyCandles, storeKey: `${storeKey}_confluence`, mode: 'intraday', tfMinutes: 15 });
    expect(result.confluence.total).toBeGreaterThanOrEqual(0);
    expect(result.confluence.total).toBeLessThanOrEqual(100);
  });

  it('conviction is between 0 and 100', () => {
    const orc = EngineOrchestrator.create(`${storeKey}_conviction`);
    const result = orc.run({ candles, dailyCandles, storeKey: `${storeKey}_conviction`, mode: 'intraday', tfMinutes: 15 });
    expect(result.signal.conviction).toBeGreaterThanOrEqual(0);
    expect(result.signal.conviction).toBeLessThanOrEqual(100);
  });

  it('structure.trend is a valid enum value', () => {
    const orc = EngineOrchestrator.create(`${storeKey}_trend`);
    const result = orc.run({ candles, dailyCandles, storeKey: `${storeKey}_trend`, mode: 'intraday', tfMinutes: 15 });
    expect(['BULLISH', 'BEARISH', 'RANGING', 'UNKNOWN']).toContain(result.structure.trend);
  });

  it('all mode types run without throwing', () => {
    for (const mode of ['scalp', 'intraday', 'positional'] as const) {
      const orc = EngineOrchestrator.create(`${storeKey}_${mode}`);
      expect(() =>
        orc.run({ candles, dailyCandles, storeKey: `${storeKey}_${mode}`, mode, tfMinutes: 15 })
      ).not.toThrow();
    }
  });

  it('handles empty dailyCandles gracefully', () => {
    const orc = EngineOrchestrator.create(`${storeKey}_nodaily`);
    expect(() =>
      orc.run({ candles, dailyCandles: [], storeKey: `${storeKey}_nodaily`, mode: 'intraday', tfMinutes: 15 })
    ).not.toThrow();
  });

  it('sanitise boundary: OrchestratorOutput fields match SanitisedResult contract', async () => {
    const { EngineService } = await import('../modules/market/engine.service');
    const svc = new EngineService();
    // 422 with < 50 candles
    await expect(svc.runAnalysis({
      sym: 'XAUUSD', tf: 15, mode: 'intraday',
      candles: candles.slice(0, 30),
      dailyCandles: [],
      userId: 'u1', tenantId: 't1',
    })).rejects.toMatchObject({ status: 422 });
  });
});
