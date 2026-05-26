/**
 * Nexus V30 — Risk Engine
 *
 * All position-sizing, pip value, lot calculation, and R:R math.
 * Direct TypeScript port of v2 riskService.js — same instrument specs,
 * same calculation model, now with multi-tenant balance support.
 *
 * Server-side only. The frontend sends raw inputs; derived values
 * (lot size, pip value, position size, R:R) never computed in browser.
 */

export interface InstrumentSpec {
  name:      string;
  pip:       number;
  contract:  number;
  digits:    number;
  isCrypto:  boolean;
  minLot:    number;
  maxLot:    number;
}

// Instrument specs (server-side — protect proprietary pip models)
export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  XAUUSD:  { name: 'Gold',       pip: 0.01,   contract: 100,    digits: 2, isCrypto: false, minLot: 0.01, maxLot: 100 },
  EURUSD:  { name: 'EUR/USD',    pip: 0.0001, contract: 100000, digits: 5, isCrypto: false, minLot: 0.01, maxLot: 100 },
  GBPUSD:  { name: 'GBP/USD',    pip: 0.0001, contract: 100000, digits: 5, isCrypto: false, minLot: 0.01, maxLot: 100 },
  USDJPY:  { name: 'USD/JPY',    pip: 0.01,   contract: 100000, digits: 3, isCrypto: false, minLot: 0.01, maxLot: 100 },
  BTCUSD:  { name: 'Bitcoin',    pip: 1,      contract: 1,      digits: 2, isCrypto: true,  minLot: 0.001, maxLot: 10 },
  ETHUSD:  { name: 'Ethereum',   pip: 0.01,   contract: 1,      digits: 2, isCrypto: true,  minLot: 0.01, maxLot: 100 },
  XAGUSD:  { name: 'Silver',     pip: 0.001,  contract: 5000,   digits: 3, isCrypto: false, minLot: 0.01, maxLot: 100 },
  USOIL:   { name: 'WTI Crude',  pip: 0.01,   contract: 1000,   digits: 2, isCrypto: false, minLot: 0.01, maxLot: 100 },
  INDICES: { name: 'Indices',    pip: 1,      contract: 1,      digits: 2, isCrypto: false, minLot: 0.01, maxLot: 100 },
  FOREX:   { name: 'Forex',      pip: 0.0001, contract: 100000, digits: 5, isCrypto: false, minLot: 0.01, maxLot: 100 },
};

export interface RiskCalcInput {
  sym:      string;
  balance:  number;
  riskPct:  number;   // e.g. 1 = 1%
  entry:    number;
  sl:       number;
  tp?:      number;
}

export interface RiskCalcResult {
  sym:            string;
  riskAmt:        number;
  riskPct:        number;
  lots:           number;
  positionSize:   number;
  slDist:         number;
  slPips:         number;
  tpDist:         number | null;
  rr:             string | null;
  potentialProfit:number | null;
  pipValue:       number;
  lotFillPct:     number;
  warnings:       string[];
  instrument:     InstrumentSpec;
}

export class RiskEngine {
  getInstrument(sym: string): InstrumentSpec {
    return INSTRUMENTS[sym.toUpperCase()] ?? INSTRUMENTS.FOREX;
  }

  calculate(input: RiskCalcInput): RiskCalcResult {
    const inst     = this.getInstrument(input.sym);
    const riskPct  = Math.min(Math.max(parseFloat(String(input.riskPct)) || 1, 0.01), 10);
    const riskAmt  = input.balance * (riskPct / 100);
    const slDist   = Math.abs(input.entry - input.sl);
    const slPips   = slDist / inst.pip;
    const pipValue = inst.pip * inst.contract;
    const warnings: string[] = [];

    let lots = 0, positionSize = 0, tpDist: number | null = null;
    let rr: string | null = null, potentialProfit: number | null = null;

    if (slDist > 0) {
      lots = riskAmt / (slPips * pipValue);
      lots = Math.max(inst.minLot, parseFloat(lots.toFixed(2)));
      positionSize = lots * inst.contract * input.entry;

      if (input.tp && input.tp !== input.entry) {
        tpDist = Math.abs(input.tp - input.entry);
        const tpPips  = tpDist / inst.pip;
        const rawRR   = tpPips / slPips;
        rr             = `1:${rawRR.toFixed(1)}`;
        potentialProfit = tpPips * pipValue * lots;
      }

      if (lots > inst.maxLot) { warnings.push(`Lot size exceeds max ${inst.maxLot} — capped`); lots = inst.maxLot; }
      if (riskPct > 2)        warnings.push('Risk > 2% — high risk');
      if (slPips  < 5)        warnings.push('Very tight SL — consider spread');
    }

    return {
      sym:            input.sym,
      riskAmt:        parseFloat(riskAmt.toFixed(2)),
      riskPct,
      lots:           parseFloat(lots.toFixed(2)),
      positionSize:   parseFloat(positionSize.toFixed(0)),
      slDist:         parseFloat(slDist.toFixed(inst.digits)),
      slPips:         parseFloat(slPips.toFixed(1)),
      tpDist:         tpDist !== null ? parseFloat(tpDist.toFixed(inst.digits)) : null,
      rr,
      potentialProfit:potentialProfit !== null ? parseFloat(potentialProfit.toFixed(2)) : null,
      pipValue:       parseFloat(pipValue.toFixed(4)),
      lotFillPct:     Math.min(100, (lots / 5) * 100),
      warnings,
      instrument:     inst,
    };
  }

  validate(params: Partial<RiskCalcInput> & { lots?: number }): { valid: boolean; errors: string[]; warnings: string[] } {
    const inst     = this.getInstrument(params.sym ?? 'XAUUSD');
    const errors:  string[] = [];
    const warnings:string[] = [];

    if (!params.entry || params.entry <= 0) errors.push('Entry price is required');
    if (!params.sl    || params.sl    <= 0) errors.push('Stop loss is required');
    if (params.sl && params.entry && params.sl === params.entry) errors.push('SL cannot equal entry');
    if (params.lots && params.lots < inst.minLot) errors.push(`Min lot size: ${inst.minLot}`);
    if (params.lots && params.lots > inst.maxLot) errors.push(`Max lot size: ${inst.maxLot}`);

    if (params.tp && params.entry && params.sl) {
      const slDist = Math.abs(params.entry - params.sl);
      const tpDist = Math.abs(params.tp   - params.entry);
      if (slDist > 0 && tpDist / slDist < 1) warnings.push('R:R below 1:1 — not recommended');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  execPreview(params: { sym: string; lots: number; sl: number; price: number }): {
    riskDollar: number; pipValue: number; pips: number; severity: 'low' | 'medium' | 'high';
  } {
    const inst       = this.getInstrument(params.sym);
    const dist       = Math.abs(params.price - params.sl);
    const pipValue   = inst.pip * inst.contract;
    const pips       = dist / inst.pip;
    const riskDollar = pips * pipValue * params.lots;

    return {
      riskDollar: parseFloat(riskDollar.toFixed(2)),
      pipValue:   parseFloat(pipValue.toFixed(4)),
      pips:       parseFloat(pips.toFixed(1)),
      severity:   riskDollar > 200 ? 'high' : riskDollar > 100 ? 'medium' : 'low',
    };
  }
}
