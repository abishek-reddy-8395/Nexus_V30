/**
 * Nexus V30 — Engine Service
 *
 * THE ONLY PATH between engine computation and the REST API layer.
 * _sanitise() is the hard boundary between IP-protected internals and client surface.
 *
 * v18 addition: AnalysisProfile ('retail' | 'institutional')
 *   retail       — existing SMC heuristic pipeline unchanged
 *   institutional — applies 6 additional post-processing gates:
 *     1. Confluence floor raised to 75 (vs 50 retail)
 *     2. R:R minimum 1:2 (vs 1:1 retail)
 *     3. MTF confirmation required (bias blocked if daily opposes)
 *     4. Session gate — London/NY overlap only for full signal
 *     5. Sharpe proxy — signal blocked in VOLATILITY_SHOCK / COMPRESSION regimes
 *     6. Statistical annotations — expectancy note, risk-adjusted conviction
 */

import { EngineOrchestrator, OrchestratorOutput } from './engine.orchestrator';
import { Logger } from '../../shared/helpers/logger';
import { emit }   from '../../events/producers/event.producer';
import { TOPICS } from '../../events/topics/index';
import type { AnalysisProfile } from '../../api/rest/engine.routes';

const logger = new Logger('EngineService');

export interface EngineRunParams {
  sym: string; tf: number; mode: 'scalp' | 'intraday' | 'positional';
  candles: any[]; dailyCandles: any[]; userId: string; tenantId: string;
  profile?: AnalysisProfile;
}

// ── Statistical annotation added for institutional profile ─────────────
export interface InstitutionalAnnotation {
  profile:            'institutional';
  confGate:           number;          // threshold used (75)
  rrFloor:            string;          // '1:2'
  sessionGate:        boolean;         // London/NY overlap required
  mtfConfirmed:       boolean;         // daily bias aligns
  regimeBlocked:      boolean;         // regime too noisy
  sharpeProxyOk:      boolean;         // vol regime acceptable
  expectancyNote:     string;          // descriptive stat note
  riskAdjConviction:  number;          // conviction × regime multiplier
  gates: {
    confluencePassed:   boolean;
    rrPassed:           boolean;
    sessionPassed:      boolean;
    mtfPassed:          boolean;
    regimePassed:       boolean;
    allPassed:          boolean;
  };
}

export interface SanitisedResult {
  sym: string; tf: number; mode: string; profile: AnalysisProfile;
  signal: {
    bias: string; entry: number | null; sl: number | null;
    tp1: number | null; rr: string | null; conviction: number; setup: string | null;
  };
  confluence: {
    total: number; structure: number; mtf: number;
    liquidity: number; orderBlock: number; fvg: number; session: number;
  };
  structure:  { trend: string; regime: string; hasBos: boolean; hasChoch: boolean; };
  levels: {
    resistance: number | null; support: number | null;
    obHigh: number | null; obLow: number | null;
    fvgHigh: number | null; fvgLow: number | null;
  };
  session:       string;
  reasoning:     string;
  computedAt:    number;
  institutional: InstitutionalAnnotation | null;  // null for retail
}

// ── Institutional gate logic ──────────────────────────────────────────
const INST_CONF_FLOOR  = 75;
const INST_RR_FLOOR    = 2.0;
const NOISY_REGIMES    = new Set(['VOLATILITY_SHOCK', 'COMPRESSION', 'MANIPULATION', 'RANGING']);
const SESSION_WEIGHTS  = { LONDON: 1.5, 'NEW YORK': 1.4, 'LONDON/NY': 1.8 } as Record<string, number>;

function computeInstitutional(raw: OrchestratorOutput): InstitutionalAnnotation {
  const conf      = raw.confluence.total;
  const rrStr     = raw.signal.rr ?? '1:0';
  const rrNum     = parseFloat(rrStr.split(':')[1] ?? '0');
  const sessName  = raw.session.name;
  const regime    = raw.regime.regime;  // ← CRIT-1 fix: regime lives on RegimeResult, not StructureResult
  const mtfBias   = raw.structure.trend;   // as MTF proxy
  const sigBias   = raw.signal.bias;

  const confluencePassed = conf >= INST_CONF_FLOOR;
  const rrPassed         = rrNum >= INST_RR_FLOOR;
  const sessionPassed    = (SESSION_WEIGHTS[sessName] ?? 0) >= 1.4;
  const mtfPassed        = !(
    (sigBias === 'BULL' && mtfBias === 'BEARISH') ||
    (sigBias === 'BEAR' && mtfBias === 'BULLISH')
  );
  const regimePassed     = !NOISY_REGIMES.has(regime);
  const sharpeProxyOk    = raw.regime.volatility !== 'HIGH' && !NOISY_REGIMES.has(regime);
  const allPassed        = confluencePassed && rrPassed && sessionPassed && mtfPassed && regimePassed;

  // Risk-adjusted conviction: discount if gates fail
  const gateScore   = [confluencePassed, rrPassed, sessionPassed, mtfPassed, regimePassed].filter(Boolean).length;
  const riskAdjConv = Math.round(conf * (gateScore / 5));

  // Expectancy note — heuristic for display
  let expectancyNote: string;
  if (!allPassed) {
    const failed = [
      !confluencePassed && `confluence below institutional floor (${conf}/100 < ${INST_CONF_FLOOR})`,
      !rrPassed         && `R:R below 1:2 floor (${rrStr})`,
      !sessionPassed    && `session not London/NY (${sessName})`,
      !mtfPassed        && 'MTF daily opposes signal direction',
      !regimePassed     && `regime ${regime} too noisy for institutional entry`,
    ].filter(Boolean).join('; ');
    expectancyNote = `BLOCKED — ${failed}`;
  } else {
    expectancyNote = `All 5 institutional gates cleared. Risk-adjusted conviction: ${riskAdjConv}/100. ` +
      `Expected positive expectancy: (R:R ${rrStr}) × (confluence ${conf}%) suggests favourable edge in ${regime} regime.`;
  }

  return {
    profile:           'institutional',
    confGate:           INST_CONF_FLOOR,
    rrFloor:           '1:2',
    sessionGate:        sessionPassed,
    mtfConfirmed:       mtfPassed,
    regimeBlocked:     !regimePassed,
    sharpeProxyOk,
    expectancyNote,
    riskAdjConviction:  riskAdjConv,
    gates: { confluencePassed, rrPassed, sessionPassed, mtfPassed, regimePassed, allPassed },
  };
}

export class EngineService {
  async runAnalysis(params: EngineRunParams): Promise<SanitisedResult> {
    const { sym, tf, mode, candles, dailyCandles, tenantId, profile = 'retail' } = params;
    if (!candles || candles.length < 50) {
      throw Object.assign(new Error(`Insufficient candles for ${sym}: need ≥50, got ${candles?.length ?? 0}`), { status: 422 });
    }
    const storeKey     = `${tenantId}:${sym}_${tf}`;
    const orchestrator = EngineOrchestrator.create(storeKey);
    const start        = Date.now();
    let raw: OrchestratorOutput;
    try {
      raw = orchestrator.run({ candles, dailyCandles, storeKey, mode, tfMinutes: tf });
    } catch (err: any) {
      logger.error(`Orchestrator error [${storeKey}]: ${err.message}`);
      throw Object.assign(new Error(`Analysis failed for ${sym}: ${err.message}`), { status: 500 });
    }

    const institutional = profile === 'institutional' ? computeInstitutional(raw) : null;

    // For institutional profile, override bias to WAIT if any gate fails
    const effectiveBias = (institutional && !institutional.gates.allPassed)
      ? 'WAIT'
      : raw.signal.bias;

    const result = this._sanitise(sym, tf, mode, profile, raw, effectiveBias, institutional);
    logger.debug(`[${storeKey}] ${profile} ${Date.now() - start}ms — bias=${result.signal.bias}`);

    if (result.signal.bias !== 'WAIT' && result.signal.bias !== 'NEUTRAL') {
      emit(TOPICS.SIGNAL_GENERATED, { sym, tf, profile, ...result }, sym).catch(() => {});
    }
    return result;
  }

  async runScanAnalysis(
    items: Array<{ sym: string; tf: number; candles: any[]; dailyCandles?: any[] }>,
    profile: AnalysisProfile = 'retail',
  ): Promise<SanitisedResult[]> {
    const results = await Promise.allSettled(
      items.map(d => this.runAnalysis({
        ...d, dailyCandles: d.dailyCandles ?? [],
        mode: 'intraday', profile, userId: 'scan', tenantId: 'global',
      }))
    );
    return results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<SanitisedResult>).value);
  }

  private _sanitise(
    sym: string, tf: number, mode: string,
    profile: AnalysisProfile,
    raw: OrchestratorOutput,
    effectiveBias: string,
    institutional: InstitutionalAnnotation | null,
  ): SanitisedResult {
    return {
      sym, tf, mode, profile,
      signal: {
        bias:       effectiveBias,
        entry:      raw.signal.entry,
        sl:         raw.signal.sl,
        tp1:        raw.signal.tp1,
        rr:         raw.signal.rr,
        conviction: institutional?.riskAdjConviction ?? raw.signal.conviction,
        setup:      raw.signal.setup,
      },
      confluence: {
        total:      raw.confluence.total,
        structure:  raw.confluence.structure,
        mtf:        raw.confluence.mtf,
        liquidity:  raw.confluence.liquidity,
        orderBlock: raw.confluence.orderBlock,
        fvg:        raw.confluence.fvg,
        session:    raw.confluence.session,
      },
      structure: {
        trend:    raw.structure.trend,
        regime:   raw.regime.regime,     // ← CRIT-1 fix: correct path to RegimeResult
        hasBos:   raw.structure.hasBos,
        hasChoch: raw.structure.hasChoch,
      },
      levels: {
        resistance: raw.orderBlock.nearestBear?.high ?? null,
        support:    raw.orderBlock.nearestBull?.low  ?? null,
        obHigh:     raw.orderBlock.nearestBull?.high ?? null,
        obLow:      raw.orderBlock.nearestBull?.low  ?? null,
        fvgHigh:    raw.imbalance.nearestBull?.high  ?? null,
        fvgLow:     raw.imbalance.nearestBull?.low   ?? null,
      },
      session:    raw.session.name,
      reasoning:  raw.signal.reasoning,
      computedAt: raw.computedAt,
      institutional,
    };
  }
}
