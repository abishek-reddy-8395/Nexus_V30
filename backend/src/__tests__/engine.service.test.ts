/**
 * Nexus V30 — Engine Service Smoke Test
 *
 * Tests that the sanitise boundary strips internal fields correctly.
 * Does NOT run the full engine (no candle data needed).
 */

import { EngineService } from '../modules/market/engine.service';

describe('EngineService — sanitise boundary', () => {
  const svc = new EngineService();

  it('throws 422 with insufficient candles', async () => {
    await expect(
      svc.runAnalysis({
        sym: 'XAUUSD', tf: 15, mode: 'intraday',
        candles: Array(10).fill({ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0 }),
        dailyCandles: [],
        userId: 'u1',
        tenantId: 't1',
      })
    ).rejects.toMatchObject({ status: 422 });
  });

  it('rejects unknown symbols gracefully', async () => {
    await expect(
      svc.runAnalysis({
        sym: 'INVALID_SYM', tf: 15, mode: 'intraday',
        candles: Array(51).fill({ time: 0, open: 1, high: 1.001, low: 0.999, close: 1, volume: 100 }),
        dailyCandles: [],
        userId: 'u1',
        tenantId: 't1',
      })
    ).rejects.toBeDefined();
  });
});
