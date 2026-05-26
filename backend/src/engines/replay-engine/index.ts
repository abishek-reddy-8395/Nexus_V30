/**
 * Nexus V30 — Replay / Backtesting Engine
 *
 * Deterministic candle-by-candle replay of the full SMC engine pipeline.
 * Designed for:
 *   - Strategy validation against historical OHLCV data
 *   - Signal accuracy measurement
 *   - Confluence threshold tuning
 *   - Regression testing (engine determinism checks)
 *
 * Determinism guarantee: given identical candle input, the engine produces
 * identical output across runs. No random() or Date.now() inside engine calls.
 */

import { EngineOrchestrator } from '../../modules/market/engine.orchestrator';
import { Logger }             from '../../shared/helpers/logger';
import type { Candle }        from '../../modules/market/engine.orchestrator';

export interface ReplayInput {
  candles:      Candle[];
  dailyCandles: Candle[];
  sym:          string;
  tf:           number;
  mode:         'scalp' | 'intraday' | 'positional';
  tenantId:     string;
  /** Minimum candle window size for each analysis step (default: 50) */
  windowSize?:  number;
  /** Emit progress callback every N steps */
  progressEvery?: number;
}

export interface ReplaySignal {
  step:       number;
  time:       number;
  price:      number;
  bias:       string;
  conviction: number;
  entry:      number | null;
  sl:         number | null;
  tp1:        number | null;
  rr:         string | null;
  setup:      string | null;
  confluenceTotal: number;
  regime:     string;
  hasBos:     boolean;
  hasChoch:   boolean;
}

export interface ReplayResult {
  sym:          string;
  tf:           number;
  mode:         string;
  totalCandles: number;
  stepsRun:     number;
  signals:      ReplaySignal[];
  summary: {
    bullSignals:    number;
    bearSignals:    number;
    waitSignals:    number;
    avgConviction:  number;
    avgConfluence:  number;
    highConfluence: number;  // signals with confluence >= 75
  };
  durationMs:   number;
}

const logger = new Logger('ReplayEngine');

export class ReplayEngine {
  /**
   * Run deterministic replay across all candles.
   * Each step advances by 1 candle using a rolling window.
   */
  async run(
    input: ReplayInput,
    onProgress?: (step: number, total: number) => void,
  ): Promise<ReplayResult> {
    const {
      candles, dailyCandles, sym, tf, mode, tenantId,
      windowSize = 50,
      progressEvery = 10,
    } = input;

    if (candles.length < windowSize) {
      throw Object.assign(
        new Error(`Replay needs ≥${windowSize} candles, got ${candles.length}`),
        { status: 422 },
      );
    }

    const storeKey    = `replay:${tenantId}:${sym}_${tf}_${Date.now()}`;
    const orchestrator = EngineOrchestrator.create(storeKey);
    const signals: ReplaySignal[] = [];
    const start = Date.now();

    const totalSteps = candles.length - windowSize;

    for (let i = 0; i <= totalSteps; i++) {
      const window = candles.slice(i, i + windowSize);

      try {
        const result = orchestrator.run({
          candles:   window,
          dailyCandles,
          storeKey,
          mode,
          tfMinutes: tf,
        });

        const lastCandle = window[window.length - 1];
        signals.push({
          step:            i,
          time:            lastCandle.time,
          price:           lastCandle.close,
          bias:            result.signal.bias,
          conviction:      result.signal.conviction,
          entry:           result.signal.entry,
          sl:              result.signal.sl,
          tp1:             result.signal.tp1,
          rr:              result.signal.rr,
          setup:           result.signal.setup,
          confluenceTotal: result.confluence.total,
          regime:          result.regime.regime,
          hasBos:          result.structure.hasBos,
          hasChoch:        result.structure.hasChoch,
        });
      } catch (err: any) {
        logger.debug(`Replay step ${i} skipped: ${err.message}`);
      }

      if (onProgress && i % progressEvery === 0) {
        onProgress(i, totalSteps);
      }
    }

    const bullSignals   = signals.filter(s => s.bias === 'BULL').length;
    const bearSignals   = signals.filter(s => s.bias === 'BEAR').length;
    const waitSignals   = signals.filter(s => s.bias === 'WAIT' || s.bias === 'NEUTRAL').length;
    const avgConviction = signals.reduce((s, v) => s + v.conviction, 0) / (signals.length || 1);
    const avgConfluence = signals.reduce((s, v) => s + v.confluenceTotal, 0) / (signals.length || 1);
    const highConfluence = signals.filter(s => s.confluenceTotal >= 75).length;

    const result: ReplayResult = {
      sym, tf, mode,
      totalCandles: candles.length,
      stepsRun:     signals.length,
      signals,
      summary: {
        bullSignals,
        bearSignals,
        waitSignals,
        avgConviction:  parseFloat(avgConviction.toFixed(1)),
        avgConfluence:  parseFloat(avgConfluence.toFixed(1)),
        highConfluence,
      },
      durationMs: Date.now() - start,
    };

    logger.info(`Replay complete: ${sym} ${tf}m — ${signals.length} steps in ${result.durationMs}ms`);
    return result;
  }

  /**
   * Determinism check: run the same input twice, assert outputs are identical.
   * Used in CI to catch non-deterministic engine regressions.
   */
  async assertDeterministic(input: ReplayInput): Promise<{ deterministic: boolean; diff?: string }> {
    const run1 = await this.run(input);
    const run2 = await this.run(input);

    for (let i = 0; i < run1.signals.length; i++) {
      const a = run1.signals[i];
      const b = run2.signals[i];
      if (a.bias !== b.bias || a.conviction !== b.conviction || a.confluenceTotal !== b.confluenceTotal) {
        return {
          deterministic: false,
          diff: `Step ${i}: run1=${a.bias}/${a.conviction}/${a.confluenceTotal} run2=${b.bias}/${b.conviction}/${b.confluenceTotal}`,
        };
      }
    }

    return { deterministic: true };
  }
}
