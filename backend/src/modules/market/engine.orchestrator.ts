/**
 * Nexus V30 — Engine Orchestrator
 *
 * Sequences all engines with strict isolation:
 *   - Each engine receives typed result objects from prior engines
 *   - No engine imports another engine's internal implementation
 *   - All composition happens here via typed contracts
 *   - Raw output is sanitised in engine.service.ts before leaving the backend
 */

import { StructureEngine }    from '../../engines/market-structure/index';
import { LiquidityEngine }    from '../../engines/liquidity/index';
import { ImbalanceEngine }    from '../../engines/imbalance/index';
import { OrderBlockEngine }   from '../../engines/order-block/index';
import { SessionEngine }      from '../../engines/session-engine/index';
import { ConfluenceEngine }   from '../../engines/confluence-engine/index';
import { RegimeEngine }       from '../../engines/regime-engine/index';
import { SignalEngine }       from '../../engines/signal-engine/index';
import { Logger }             from '../../shared/helpers/logger';
import type { Candle }        from '../../engines/market-structure/index';

export type { Candle };

export interface OrchestratorInput {
  candles:      Candle[];
  dailyCandles: Candle[];
  storeKey:     string;
  mode:         'scalp' | 'intraday' | 'positional';
  tfMinutes:    number;
}

export interface OrchestratorOutput {
  structure:   ReturnType<StructureEngine['run']>;
  liquidity:   ReturnType<LiquidityEngine['run']>;
  imbalance:   ReturnType<ImbalanceEngine['run']>;
  orderBlock:  ReturnType<OrderBlockEngine['run']>;
  session:     ReturnType<SessionEngine['getCurrent']>;
  confluence:  ReturnType<ConfluenceEngine['score']>;
  regime:      ReturnType<RegimeEngine['classify']>;
  signal:      ReturnType<SignalEngine['generate']>;
  computedAt:  number;
}

const logger = new Logger('EngineOrchestrator');

export class EngineOrchestrator {
  private static readonly _instances = new Map<string, EngineOrchestrator>();

  // Each engine instance is stateful per storeKey — DO NOT share across tenants
  private readonly _structure    = new StructureEngine();
  private readonly _liquidity    = new LiquidityEngine();
  private readonly _imbalance    = new ImbalanceEngine();
  private readonly _orderBlock   = new OrderBlockEngine();
  private readonly _session      = new SessionEngine();
  private readonly _confluence   = new ConfluenceEngine();
  private readonly _regime       = new RegimeEngine();
  private readonly _signal       = new SignalEngine();

  // ATR history for volRatio calculation
  private readonly _atrHistory: number[] = [];

  static create(storeKey: string): EngineOrchestrator {
    if (!this._instances.has(storeKey)) {
      this._instances.set(storeKey, new EngineOrchestrator());
      logger.debug(`Orchestrator created: ${storeKey}`);
    }
    return this._instances.get(storeKey)!;
  }

  run(input: OrchestratorInput): OrchestratorOutput {
    const { candles, dailyCandles, storeKey, mode } = input;
    const price = candles[candles.length - 1]?.close ?? 0;

    // ── 1: Structure (base — swings, BOS, CHoCH) ─────────────────────
    const structure = this._structure.run(candles, storeKey);
    const { atr }   = structure;

    // Track ATR history for regime volRatio
    this._atrHistory.push(atr);
    if (this._atrHistory.length > 20) this._atrHistory.shift();
    const avgATR = this._atrHistory.reduce((s, v) => s + v, 0) / this._atrHistory.length;

    // ── 2: Liquidity (receives typed swings from structure) ───────────
    const liquidity = this._liquidity.run(candles, structure.swings, structure.trend, atr);

    // ── 3: Imbalance/FVG (only candles + price + sweeps) ─────────────
    const imbalance = this._imbalance.run(candles, atr, liquidity.sweeps, storeKey);

    // ── 4: Order Blocks (candles + structure events + sweeps) ─────────
    const orderBlock = this._orderBlock.run(candles, structure.events, atr, liquidity.sweeps, storeKey);

    // ── 5: Session (pure time — no candles needed) ────────────────────
    const session = this._session.getCurrent();

    // ── 6: MTF bias (derived from daily candles, no engine coupling) ──
    const mtfBias     = this._deriveMtfBias(dailyCandles);
    const mtfAligned  = mtfBias !== 'NEUTRAL';

    // ── 7: Regime (structure + liquidity + ATR volatility) ────────────
    const regime = this._regime.classify(candles, structure, liquidity, atr, avgATR);

    // ── 8: Confluence (receives typed results — no internals) ──────────
    const confluence = this._confluence.score({
      structure, liquidity, orderBlock, imbalance,
      mtfBias, mtfAligned,
      sessionWeight: session.weight,
      regime: regime.regime,
    });

    // Apply regime bias adjustment
    const regimeAdj = this._regime.applyToConfluence(confluence.total, confluence.direction, regime);
    const adjConfluence = { ...confluence, total: regimeAdj.adjustedScore };

    // ── 9: Signal (confluence + regime + levels) ───────────────────────
    const signal = this._signal.generate({
      confluence: adjConfluence,
      regime,
      price,
      atr,
      obs:       orderBlock.activeBlocks,
      fvgs:      imbalance.activeFvgs,
      liquidity,
      hasBos:    structure.hasBos,
      hasChoch:  structure.hasChoch,
      mode,
    });

    logger.debug(`[${storeKey}] bias=${signal.bias} score=${adjConfluence.total} regime=${regime.regime}`);

    return { structure, liquidity, imbalance, orderBlock, session, confluence: adjConfluence, regime, signal, computedAt: Date.now() };
  }

  private _deriveMtfBias(dailyCandles: Candle[]): 'BULL' | 'BEAR' | 'NEUTRAL' {
    if (!dailyCandles?.length || dailyCandles.length < 5) return 'NEUTRAL';
    const last   = dailyCandles[dailyCandles.length - 1];
    const prev5  = dailyCandles.slice(-6, -1);
    if (!prev5.length) return 'NEUTRAL';
    const avg    = prev5.reduce((s, c) => s + c.close, 0) / prev5.length;
    if (last.close > avg * 1.001) return 'BULL';
    if (last.close < avg * 0.999) return 'BEAR';
    return 'NEUTRAL';
  }
}
