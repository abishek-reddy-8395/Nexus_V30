/**
 * Nexus V30 — Confluence Engine Tests
 */
import { ConfluenceEngine } from '../engines/confluence-engine/index';

const engine = new ConfluenceEngine();

describe('ConfluenceEngine', () => {
  const baseInput = {
    structure:   { trend: 'BULL', swing: 'UP',   bos: true,  choch: false, score: 20 },
    liquidity:   { sweep: false,  void: true,              score: 10 },
    imbalance:   { fvgActive: true, mitigated: false,      score: 12 },
    orderBlock:  { active: true,  breaker: false,          score: 15 },
    session:     { active: true,  killZone: true,          score: 5  },
    regime:      { trending: true, volatile: false,        score: 8  },
  };

  it('returns a numeric total between 0 and 100', () => {
    const result = engine.aggregate(baseInput as any);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('returns higher score when more signals align', () => {
    const weak   = { ...baseInput, orderBlock: { active: false, breaker: false, score: 0 }, imbalance: { fvgActive: false, mitigated: true, score: 0 } };
    const strong = baseInput;
    const weakResult   = engine.aggregate(weak   as any);
    const strongResult = engine.aggregate(strong as any);
    expect(strongResult.total).toBeGreaterThan(weakResult.total);
  });

  it('includes per-component breakdown', () => {
    const result = engine.aggregate(baseInput as any);
    expect(result).toHaveProperty('breakdown');
  });
});
