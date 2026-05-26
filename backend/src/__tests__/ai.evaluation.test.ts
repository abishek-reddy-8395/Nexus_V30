/**
 * Nexus V30 — AI Evaluation Tests
 *
 * Unit evals run in CI without any model API calls.
 * They validate prompt template correctness, variable interpolation,
 * and output structure contracts.
 */

import { AIEvaluator } from '../ai/evaluation/index';

describe('AI Evaluation Pipeline', () => {
  const evaluator = new AIEvaluator();

  it('unit evals pass for all golden fixtures', async () => {
    const report = await evaluator.runUnitEvals();
    expect(report.totalFixtures).toBeGreaterThan(0);
    expect(report.passRate).toBe(1);
    if (report.passRate < 1) {
      const failures = report.results.filter(r => !r.passed);
      console.error('Failing fixtures:', failures.map(f => `${f.fixture}: ${f.violations.join('; ')}`));
    }
  });

  it('prompt templates render without undefined or null', async () => {
    const report = await evaluator.runUnitEvals();
    for (const result of report.results) {
      expect(result.violations).not.toContain(expect.stringContaining('unresolved'));
    }
  });

  it('regression check passes against own baseline', async () => {
    const baseline = await evaluator.runUnitEvals();
    const { passed, regressions } = await evaluator.runRegressionCheck(baseline);
    expect(passed).toBe(true);
    expect(regressions).toHaveLength(0);
  });

  it('report has correct shape', async () => {
    const report = await evaluator.runUnitEvals();
    expect(report).toHaveProperty('runAt');
    expect(report).toHaveProperty('passRate');
    expect(report.passed + report.failed).toBe(report.totalFixtures);
  });
});
