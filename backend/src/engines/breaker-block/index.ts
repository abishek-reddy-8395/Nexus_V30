/**
 * Nexus V30 — Breaker Block Engine
 * Broken OBs that flip polarity. Consumed by Orchestrator after OB detection.
 */

import type { OrderBlock } from '../order-block/index';

export interface BreakerBlock {
  type:   'BULL_BREAKER' | 'BEAR_BREAKER';
  high:   number; low: number;
  origin: 'BROKEN_BULL_OB' | 'BROKEN_BEAR_OB';
  time:   number; fresh: boolean;
}

export class BreakerBlockEngine {
  /** Extract breaker blocks from order blocks that have been broken through */
  run(orderBlocks: OrderBlock[], currentPrice: number): BreakerBlock[] {
    return orderBlocks
      .filter(ob => ob.status === 'BREAKER')
      .map(ob => ({
        type:   ob.type === 'BULL_OB' ? 'BEAR_BREAKER' : 'BULL_BREAKER',
        high:   ob.top,
        low:    ob.bottom,
        origin: ob.type === 'BULL_OB' ? 'BROKEN_BULL_OB' : 'BROKEN_BEAR_OB',
        time:   ob.time,
        fresh:  Math.abs(ob.mid - currentPrice) < (ob.top - ob.bottom) * 3,
      } as BreakerBlock));
  }
}
