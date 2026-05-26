/**
 * Nexus V30 — Mitigation Engine
 * Marks zones as mitigated when price trades back into them.
 * Stateless — operates on arrays passed in by the Orchestrator.
 */

export interface MitigationZone {
  id: string; type: 'OB' | 'FVG' | 'BREAKER';
  high: number; low: number;
  mitigated: boolean; mitigatedAt: number | null; fillPct: number;
}

export class MitigationEngine {
  /** Update mitigation state for a set of zones against new candles */
  update(zones: MitigationZone[], candles: Array<{ high: number; low: number; close: number; time: number }>): MitigationZone[] {
    return zones.map(zone => {
      if (zone.mitigated) return zone;
      for (const c of candles) {
        const penetrates = zone.type === 'OB'
          ? (c.low <= zone.high && c.low >= zone.low)
          : (c.high >= zone.low && c.high <= zone.high);
        if (penetrates) {
          const depth = zone.type === 'OB'
            ? (zone.high - Math.max(c.low, zone.low)) / Math.max(zone.high - zone.low, 1e-10)
            : (Math.min(c.high, zone.high) - zone.low) / Math.max(zone.high - zone.low, 1e-10);
          const fillPct = Math.min(100, depth * 100);
          if (fillPct >= 50) return { ...zone, fillPct, mitigated: true, mitigatedAt: c.time };
          return { ...zone, fillPct };
        }
      }
      return zone;
    });
  }
}
