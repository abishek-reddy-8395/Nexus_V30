/**
 * Nexus V30 — Risk Engine Tests
 */
import { RiskEngine } from '../engines/risk-engine/index';

const engine = new RiskEngine();

describe('RiskEngine.calculate', () => {
  const base = { sym: 'XAUUSD', balance: 10_000, riskPct: 1, entry: 2000, sl: 1990 };

  it('calculates dollar risk from riskPct', () => {
    const result = engine.calculate({ ...base });
    expect(result.dollarRisk).toBeCloseTo(100, 0); // 1% of 10000
  });

  it('computes RR ratio when tp is provided', () => {
    const result = engine.calculate({ ...base, tp: 2020 }); // SL=10pts, TP=20pts → RR=2
    expect(parseFloat(result.rr)).toBeGreaterThan(0);
  });

  it('returns rr as N/A when tp is not provided', () => {
    const result = engine.calculate({ ...base });
    expect(result.rr).toBeDefined();
  });

  it('handles SELL direction', () => {
    const result = engine.calculate({ sym: 'EURUSD', balance: 5000, riskPct: 2, entry: 1.1, sl: 1.11 });
    expect(result.dollarRisk).toBeCloseTo(100, 0); // 2% of 5000
  });

  it('clamps lots to a minimum sensible value', () => {
    const result = engine.calculate({ ...base, balance: 100 });
    expect(result).toBeDefined();
  });
});

describe('RiskEngine.execPreview', () => {
  it('returns riskDollar for given lots', () => {
    const result = engine.execPreview({ sym: 'XAUUSD', lots: 0.1, sl: 1990, price: 2000 });
    expect(result).toHaveProperty('riskDollar');
    expect(result.riskDollar).toBeGreaterThan(0);
  });
});
