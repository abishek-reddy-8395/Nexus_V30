/**
 * Nexus V30 — Execution Engine
 *
 * Validates and prepares trade execution parameters server-side.
 * Enforces pre-trade checklist: confluence minimum, session validity,
 * R:R threshold, lot limits, SL and TP presence.
 *
 * Architecture fix: no longer directly imports RiskEngine.
 * Risk metrics are accepted as pre-computed inputs from the orchestrator,
 * maintaining clean engine isolation (type-only cross-engine contracts).
 */

export interface ExecutionParams {
  sym:           string;
  dir:           'BUY' | 'SELL';
  lots:          number;
  sl:            number;
  tp:            number;
  entry:         number;
  mode:          'market' | 'limit' | 'stop';
  confluence:    number;
  sessionWeight: number;
  userId:        string;
  tenantId:      string;
  // Pre-computed risk values supplied by caller (from RiskEngine) — not computed here
  riskDollar:    number;
  rr:            string | null;
}

export interface ExecutionPreview {
  valid:          boolean;
  riskDollar:     number;
  rr:             string | null;
  warnings:       string[];
  blockers:       string[];
  preTradeChecks: PreTradeCheck[];
}

export interface PreTradeCheck {
  id:     string;
  label:  string;
  passed: boolean;
  warn?:  string;
}

export class ExecutionEngine {
  preview(params: ExecutionParams, balance: number): ExecutionPreview {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const checks: PreTradeCheck[] = [
      {
        id: 'confluence', label: 'Confluence ≥ 65',
        passed: params.confluence >= 65,
      },
      {
        id: 'session', label: 'Active session (London / NY)',
        passed: params.sessionWeight >= 1.2,
      },
      {
        id: 'rr', label: 'R:R ≥ 1:1',
        passed: params.rr ? parseFloat(params.rr.split(':')[1] ?? '0') >= 1 : false,
      },
      {
        id: 'lots', label: 'Risk within account limits',
        passed: balance > 0 ? params.riskDollar < balance * 0.1 : true,
      },
      {
        id: 'sl', label: 'Stop loss set',
        passed: !!params.sl && params.sl > 0,
      },
      {
        id: 'tp', label: 'Take profit set',
        passed: !!params.tp && params.tp > 0,
      },
    ];

    for (const check of checks) {
      if (!check.passed) {
        if (['sl', 'lots'].includes(check.id)) blockers.push(check.label);
        else warnings.push(check.label);
      }
    }

    if (params.confluence < 55) warnings.push('Very low confluence — consider waiting');
    if (params.sessionWeight < 0.8) warnings.push('Low-volatility session — wider spreads likely');

    return {
      valid:          blockers.length === 0,
      riskDollar:     params.riskDollar,
      rr:             params.rr,
      warnings,
      blockers,
      preTradeChecks: checks,
    };
  }
}
