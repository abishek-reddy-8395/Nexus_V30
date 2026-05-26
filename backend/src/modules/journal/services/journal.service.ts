/**
 * Nexus V30 — Journal Service (Prisma-backed)
 *
 * Trade journal CRUD + performance statistics.
 * Persists to PostgreSQL via Prisma — data survives restarts.
 * Emits Kafka events for downstream processing (analytics, notifications).
 */

import { randomUUID } from 'crypto';
import { prisma }     from '../../../database/prisma/client';
import { Logger }     from '../../../shared/helpers/logger';
import { emit }       from '../../../events/producers/event.producer';
import { TOPICS }     from '../../../events/topics/index';

const logger = new Logger('JournalService');

export interface JournalEntry {
  id:             string;
  userId:         string;
  tenantId:       string;
  sym:            string;
  dir:            'BUY' | 'SELL';
  mode:           'scalp' | 'intraday' | 'positional';
  entry:          number | null;
  sl:             number | null;
  tp1:            number | null;
  rr:             string | null;
  conviction:     number | null;
  result:         'win' | 'loss' | 'be' | null;
  pnl:            number | null;
  notes:          string | null;
  tags:           string[];
  confluenceScore:number | null;
  structure:      string | null;
  session:        string | null;
  signal:         string | null;
  ts:             Date;
  tsStr:          string;
}

export interface JournalStats {
  total:        number;
  wins:         number;
  losses:       number;
  be:           number;
  winRate:      number;
  totalPnl:     number;
  avgPnl:       number;
  expectancy:   number;
  profitFactor: number;
  bestStreak:   number;
  worstStreak:  number;
  avgConviction:number;
}

function mapRow(row: any): JournalEntry {
  return {
    id:             row.id,
    userId:         row.userId,
    tenantId:       row.tenantId,
    sym:            row.sym,
    dir:            row.dir as 'BUY' | 'SELL',
    mode:           row.mode as JournalEntry['mode'],
    entry:          row.entry ? Number(row.entry) : null,
    sl:             row.sl   ? Number(row.sl)    : null,
    tp1:            row.tp1  ? Number(row.tp1)   : null,
    rr:             row.rr   ?? null,
    conviction:     row.conviction ?? null,
    result:         row.result as JournalEntry['result'],
    pnl:            row.pnl  ? Number(row.pnl)  : null,
    notes:          row.notes ?? null,
    tags:           row.tags  ?? [],
    confluenceScore:row.confluenceScore ?? null,
    structure:      row.structure ?? null,
    session:        row.session   ?? null,
    signal:         row.signal    ?? null,
    ts:             row.ts,
    tsStr:          row.ts.toISOString(),
  };
}

export class JournalService {
  async getEntries(userId: string, _tenantId: string): Promise<JournalEntry[]> {
    const rows = await prisma.journalEntry.findMany({
      where:   { userId },
      orderBy: { ts: 'desc' },
    });
    return rows.map(mapRow);
  }

  async addEntry(userId: string, tenantId: string, data: Partial<JournalEntry>): Promise<JournalEntry> {
    const row = await prisma.journalEntry.create({
      data: {
        userId,
        tenantId,
        sym:            (data.sym ?? 'UNKNOWN').toUpperCase(),
        dir:            data.dir   ?? 'BUY',
        mode:           data.mode  ?? 'intraday',
        entry:          data.entry ?? null,
        sl:             data.sl    ?? null,
        tp1:            data.tp1   ?? null,
        rr:             data.rr    ?? null,
        conviction:     data.conviction ?? null,
        result:         data.result ?? null,
        pnl:            data.pnl    ?? null,
        notes:          data.notes  ?? null,
        tags:           data.tags   ?? [],
        confluenceScore:data.confluenceScore ?? null,
        structure:      data.structure ?? null,
        session:        data.session   ?? null,
        signal:         data.signal    ?? null,
      },
    });

    await emit(TOPICS.TRADE_LOGGED, { entry: mapRow(row) }, userId).catch(() => {});
    logger.debug(`Trade logged: ${row.sym} ${row.dir} for user ${userId}`);
    return mapRow(row);
  }

  async updateEntry(
    userId:  string,
    id:      string,
    updates: Partial<Pick<JournalEntry, 'result' | 'pnl' | 'notes' | 'tags' | 'tp1' | 'sl'>>,
  ): Promise<JournalEntry> {
    const existing = await prisma.journalEntry.findFirst({ where: { id, userId } });
    if (!existing) throw Object.assign(new Error(`Entry ${id} not found`), { status: 404 });

    const row = await prisma.journalEntry.update({
      where: { id },
      data:  {
        result: updates.result ?? undefined,
        pnl:    updates.pnl    ?? undefined,
        notes:  updates.notes  ?? undefined,
        tags:   updates.tags   ?? undefined,
        tp1:    updates.tp1    ?? undefined,
        sl:     updates.sl     ?? undefined,
      },
    });

    await emit(TOPICS.TRADE_UPDATED, { id, updates }, userId).catch(() => {});
    return mapRow(row);
  }

  async deleteEntry(userId: string, id: string): Promise<void> {
    const existing = await prisma.journalEntry.findFirst({ where: { id, userId } });
    if (!existing) throw Object.assign(new Error(`Entry ${id} not found`), { status: 404 });
    await prisma.journalEntry.delete({ where: { id } });
  }

  computeStats(entries: JournalEntry[]): JournalStats {
    const resolved = entries.filter(e => e.result);
    const wins     = resolved.filter(e => e.result === 'win');
    const losses   = resolved.filter(e => e.result === 'loss');
    const be       = resolved.filter(e => e.result === 'be');

    const totalPnl  = entries.reduce((s, e) => s + (e.pnl ?? 0), 0);
    const winPnl    = wins.reduce((s, e)    => s + (e.pnl ?? 0), 0);
    const lossPnl   = Math.abs(losses.reduce((s, e) => s + (e.pnl ?? 0), 0));
    const avgPnl    = resolved.length ? totalPnl / resolved.length : 0;
    const winRate   = resolved.length ? wins.length / resolved.length : 0;
    const expectancy = wins.length && losses.length
      ? (winRate * (winPnl / wins.length)) - ((1 - winRate) * (lossPnl / losses.length))
      : 0;
    const profitFactor = lossPnl > 0 ? winPnl / lossPnl : winPnl > 0 ? Infinity : 0;
    const avgConviction = entries.reduce((s, e) => s + (e.conviction ?? 0), 0) / (entries.length || 1);

    let best = 0, worst = 0, cur = 0;
    for (const e of resolved) {
      cur = e.result === 'win' ? (cur > 0 ? cur + 1 : 1) : (cur < 0 ? cur - 1 : -1);
      if (cur > best)  best  = cur;
      if (cur < worst) worst = cur;
    }

    return {
      total:        entries.length,
      wins:         wins.length,
      losses:       losses.length,
      be:           be.length,
      winRate:      parseFloat((winRate * 100).toFixed(1)),
      totalPnl:     parseFloat(totalPnl.toFixed(2)),
      avgPnl:       parseFloat(avgPnl.toFixed(2)),
      expectancy:   parseFloat(expectancy.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      bestStreak:   best,
      worstStreak:  worst,
      avgConviction:parseFloat(avgConviction.toFixed(0)),
    };
  }

  async getStats(userId: string, tenantId: string): Promise<JournalStats> {
    const entries = await this.getEntries(userId, tenantId);
    return this.computeStats(entries);
  }
}
