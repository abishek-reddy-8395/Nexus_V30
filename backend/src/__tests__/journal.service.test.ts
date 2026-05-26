/**
 * Nexus V30 — Journal Service Unit Tests
 *
 * Tests computeStats() (pure function — no DB needed).
 */

import { JournalService, JournalEntry } from '../modules/journal/services/journal.service';

const svc = new JournalService();

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  const now = new Date();
  return {
    id: 'e1', userId: 'u1', tenantId: 't1',
    sym: 'XAUUSD', dir: 'BUY', mode: 'intraday',
    entry: 2340, sl: 2330, tp1: 2360, rr: '1:2',
    conviction: 75, result: null, pnl: null,
    notes: null, tags: [], confluenceScore: 75,
    structure: 'BULLISH', session: 'LONDON', signal: 'BULL',
    ts: now, tsStr: now.toISOString(),
    ...overrides,
  };
}

describe('JournalService.computeStats()', () => {
  it('returns zeros for empty entries', () => {
    const stats = svc.computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.totalPnl).toBe(0);
  });

  it('calculates win rate correctly', () => {
    const entries = [
      makeEntry({ result: 'win',  pnl: 100 }),
      makeEntry({ result: 'win',  pnl: 150 }),
      makeEntry({ result: 'loss', pnl: -80 }),
      makeEntry({ result: 'be',   pnl: 0   }),
    ];
    const stats = svc.computeStats(entries);
    expect(stats.total).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.be).toBe(1);
    expect(stats.winRate).toBe(66.7);  // 2/3 resolved
    expect(stats.totalPnl).toBe(170);
  });

  it('calculates profit factor', () => {
    const entries = [
      makeEntry({ result: 'win',  pnl: 200 }),
      makeEntry({ result: 'loss', pnl: -100 }),
    ];
    const stats = svc.computeStats(entries);
    expect(stats.profitFactor).toBe(2);  // 200 / 100
  });

  it('calculates win/loss streaks', () => {
    const entries = [
      makeEntry({ result: 'win'  }),
      makeEntry({ result: 'win'  }),
      makeEntry({ result: 'win'  }),
      makeEntry({ result: 'loss' }),
      makeEntry({ result: 'loss' }),
    ];
    const stats = svc.computeStats(entries);
    expect(stats.bestStreak).toBe(3);
    expect(stats.worstStreak).toBe(-2);
  });
});
