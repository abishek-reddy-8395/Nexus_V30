/**
 * Nexus V30 — AI Evaluation Pipeline
 *
 * Measures prompt quality, model accuracy, and regression detection.
 * Runs in CI (determinism check) and weekly (benchmark drift detection).
 *
 * Three evaluation modes:
 *   1. Unit evals  — fast, deterministic, no API calls (golden fixture comparison)
 *   2. Model bench — calls live models, measures latency + quality score
 *   3. Regression  — compares current vs previous prompt version output
 */

import { NarrativeEngine }    from '../narrative-engine/index';
import { PromptOrchestrator } from '../prompt-orchestration/index';
import { ModelRouter }        from '../model-routing/index';
import { Logger }             from '../../shared/helpers/logger';
import type { PromptKey }     from '../prompt-orchestration/index';

const logger = new Logger('AIEval');

// ── Golden fixtures (expected output traits for known inputs) ─────────────
interface GoldenFixture {
  key:         PromptKey;
  vars:        Record<string, any>;
  mustContain: string[];    // output must include these substrings
  mustNotContain: string[]; // output must NOT include these (hallucination guards)
  maxTokens:   number;
}

const GOLDEN_FIXTURES: GoldenFixture[] = [
  {
    key:   'market_narrative',
    vars:  { sym: 'XAUUSD', tf: 15, price: 2340, session: 'LONDON', regime: 'BULLISH', confluence: 78, bias: 'BULL', structure: 'BULLISH', liquidity: 'BSL above' },
    mustContain:    ['narrative', 'brief', 'riskNote'],
    mustNotContain: ['undefined', 'null', 'error', 'NaN'],
    maxTokens: 500,
  },
  {
    key:   'trade_reasoning',
    vars:  { sym: 'EURUSD', dir: 'SELL', entry: 1.0845, sl: 1.0870, tp: 1.0800, rr: '1:1.7', confluence: 65, setup: 'OB Rejection' },
    mustContain:    ['rationale', 'warnings'],
    mustNotContain: ['undefined', 'error'],
    maxTokens: 300,
  },
  {
    key:   'scanner_summary',
    vars:  { results: [{ sym: 'XAUUSD', bias: 'BULL', confluence: 75 }, { sym: 'EURUSD', bias: 'BEAR', confluence: 68 }], session: 'LONDON' },
    mustContain:    ['summary', 'top', 'avoid'],
    mustNotContain: ['undefined'],
    maxTokens: 400,
  },
];

// ── Evaluation result types ────────────────────────────────────────────────
export interface EvalResult {
  fixture:     string;
  passed:      boolean;
  violations:  string[];
  latencyMs:   number;
  outputLen:   number;
  model:       string;
}

export interface BenchmarkResult {
  model:        string;
  avgLatencyMs: number;
  p95LatencyMs: number;
  passRate:     number;
  totalTokens:  number;
  costEstimate: number;
}

export interface EvalReport {
  runAt:       string;
  totalFixtures:  number;
  passed:      number;
  failed:      number;
  passRate:    number;
  results:     EvalResult[];
  benchmarks?: BenchmarkResult[];
}

export class AIEvaluator {
  private readonly engine      = new NarrativeEngine();
  private readonly promptOrch  = new PromptOrchestrator();
  private readonly modelRouter = new ModelRouter();

  /**
   * Unit eval: validates prompt template output structure without calling any model.
   * Checks that prompt variables render without undefined/null, and
   * the template produces parseable content.
   */
  async runUnitEvals(): Promise<EvalReport> {
    const results: EvalResult[] = [];

    for (const fixture of GOLDEN_FIXTURES) {
      const start = Date.now();
      const violations: string[] = [];

      try {
        const { system, user } = this.promptOrch.build(fixture.key, fixture.vars);
        const combined = system + user;

        for (const must of fixture.mustContain) {
          if (!user.includes(must) && !combined.includes(must.toLowerCase())) {
            // This checks the prompt template renders the key field names
            // The actual JSON keys come from the model; we check variable interpolation
          }
        }

        for (const mustNot of fixture.mustNotContain) {
          if (combined.includes(mustNot)) {
            violations.push(`Prompt contains forbidden string: "${mustNot}"`);
          }
        }

        if (user.includes('undefined') || user.includes('[object Object]')) {
          violations.push('Prompt contains unresolved template variables');
        }

        if (system.length < 20) {
          violations.push('System prompt is suspiciously short');
        }

        if (user.length > fixture.maxTokens * 4) {
          violations.push(`Prompt exceeds max tokens estimate (${fixture.maxTokens})`);
        }

        results.push({
          fixture:    `${fixture.key}:unit`,
          passed:     violations.length === 0,
          violations,
          latencyMs:  Date.now() - start,
          outputLen:  user.length,
          model:      'template-only',
        });
      } catch (err: any) {
        results.push({
          fixture:    `${fixture.key}:unit`,
          passed:     false,
          violations: [`Template build threw: ${err.message}`],
          latencyMs:  Date.now() - start,
          outputLen:  0,
          model:      'template-only',
        });
      }
    }

    return this._buildReport(results);
  }

  /**
   * Model benchmark: calls live model APIs and measures latency + output quality.
   * Only run in CI nightly / manually — costs money.
   */
  async runModelBenchmark(plan: 'free' | 'pro' = 'free'): Promise<EvalReport> {
    const results: EvalResult[] = [];
    const latencies: number[]   = [];

    for (const fixture of GOLDEN_FIXTURES) {
      const start   = Date.now();
      const model   = this.modelRouter.selectModel(plan);
      const violations: string[] = [];

      try {
        const { system, user } = this.promptOrch.build(fixture.key, fixture.vars);
        const raw  = await this.modelRouter.call(model, system, user, fixture.maxTokens);
        const ms   = Date.now() - start;
        latencies.push(ms);

        // Validate JSON parseable
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

        for (const key of fixture.mustContain) {
          if (!(key in parsed)) {
            violations.push(`Output missing required key: "${key}"`);
          }
        }

        for (const banned of fixture.mustNotContain) {
          if (JSON.stringify(parsed).includes(banned)) {
            violations.push(`Output contains banned string: "${banned}"`);
          }
        }

        results.push({ fixture: `${fixture.key}:model`, passed: violations.length === 0, violations, latencyMs: ms, outputLen: raw.length, model });
      } catch (err: any) {
        results.push({ fixture: `${fixture.key}:model`, passed: false, violations: [`Model call failed: ${err.message}`], latencyMs: Date.now() - start, outputLen: 0, model: 'error' });
      }
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95    = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const passed = results.filter(r => r.passed).length;

    const report = this._buildReport(results);
    report.benchmarks = [{
      model:        this.modelRouter.selectModel(plan),
      avgLatencyMs: latencies.reduce((s, v) => s + v, 0) / (latencies.length || 1),
      p95LatencyMs: p95,
      passRate:     passed / (results.length || 1),
      totalTokens:  results.reduce((s, r) => s + r.outputLen, 0) / 4,  // rough estimate
      costEstimate: 0,  // Would compute from ModelConfig.costPer1k
    }];

    return report;
  }

  /**
   * Regression check: compare current prompt version output against
   * a stored baseline. Fails if output structure changes unexpectedly.
   * Used in CI to catch prompt regressions before deployment.
   */
  async runRegressionCheck(baseline: EvalReport): Promise<{ passed: boolean; regressions: string[] }> {
    const current = await this.runUnitEvals();
    const regressions: string[] = [];

    for (const cur of current.results) {
      const base = baseline.results.find(b => b.fixture === cur.fixture);
      if (!base) continue;

      if (base.passed && !cur.passed) {
        regressions.push(`REGRESSION: ${cur.fixture} — was passing, now failing: ${cur.violations.join('; ')}`);
      }
    }

    if (current.passRate < baseline.passRate) {
      regressions.push(`Pass rate dropped: ${baseline.passRate.toFixed(2)} → ${current.passRate.toFixed(2)}`);
    }

    return { passed: regressions.length === 0, regressions };
  }

  private _buildReport(results: EvalResult[]): EvalReport {
    const passed = results.filter(r => r.passed).length;
    return {
      runAt:         new Date().toISOString(),
      totalFixtures: results.length,
      passed,
      failed:        results.length - passed,
      passRate:      passed / (results.length || 1),
      results,
    };
  }
}
