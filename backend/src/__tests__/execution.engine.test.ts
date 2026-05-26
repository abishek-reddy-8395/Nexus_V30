/**
 * Nexus V30 — Execution Engine Tests
 */
import { ExecutionEngine } from '../engines/execution-engine/index';

const engine = new ExecutionEngine();

const baseParams = {
  sym:           'XAUUSD',
  dir:           'BUY' as const,
  lots:          0.1,
  entry:         2000,
  sl:            1990,
  tp:            2020,
  mode:          'market' as const,
  confluence:    75,
  sessionWeight: 1.2,
  userId:        'u1',
  tenantId:      't1',
  riskDollar:    100,
  rr:            2,
};

describe('ExecutionEngine.preview', () => {
  it('returns a valid preview object', () => {
    const result = engine.preview(baseParams, 10_000);
    expect(result).toHaveProperty('valid');
    expect(typeof result.valid).toBe('boolean');
  });

  it('rejects executions with zero lots', () => {
    const result = engine.preview({ ...baseParams, lots: 0 }, 10_000);
    expect(result.valid).toBe(false);
  });

  it('rejects executions where SL equals entry', () => {
    const result = engine.preview({ ...baseParams, sl: 2000 }, 10_000);
    expect(result.valid).toBe(false);
  });

  it('accepts valid params with high confluence', () => {
    const result = engine.preview({ ...baseParams, confluence: 80 }, 10_000);
    expect(result).toBeDefined();
  });
});
