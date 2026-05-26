/**
 * Nexus V30 — Analytics Routes (Enterprise: retention cohorts + behavioral intelligence)
 *
 * GET /api/analytics/summary         — win rate, expectancy, profit factor (trader-level)
 * GET /api/analytics/performance     — breakdown by sym, mode, session, time of day
 * GET /api/analytics/calendar        — heatmap data (PnL per day)
 * GET /api/analytics/retention       — org-level 30/60/90-day retention cohorts
 * GET /api/analytics/behavioral      — emotional trading, revenge trading, overtrading signals
 * GET /api/analytics/engagement      — DAU/WAU/MAU, session duration, engagement score
 * GET /api/analytics/insights        — AI-generated weekly insight narratives
 */
import { Router, Request, Response, NextFunction } from 'express';
import { JournalService } from '../../modules/journal/services/journal.service';
import { prisma } from '../../database/prisma/client';
import { requirePermission } from '../../middleware/auth/rbac.middleware';

const journalService = new JournalService();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

export function registerAnalyticsRoutes(): Router {
  const r = Router();

  // ── Trader-level (existing) ────────────────────────────────────────────────

  r.get('/summary', wrap(async (req: Request, res: Response) => {
    const entries = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const stats   = journalService.computeStats(entries);
    res.json({ stats, ts: Date.now() });
  }));

  r.get('/performance', wrap(async (req: Request, res: Response) => {
    const entries  = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const resolved = entries.filter(e => e.result);

    const bySym: Record<string, any>     = {};
    const byMode: Record<string, any>    = {};
    const bySession: Record<string, any> = {};

    for (const e of resolved) {
      const isWin = e.result === 'win';
      const pnl   = e.pnl ?? 0;
      for (const [key, bucket] of [
        [e.sym, bySym],
        [e.mode, byMode],
        [e.session ?? 'UNKNOWN', bySession],
      ] as [string, any][]) {
        if (!bucket[key]) bucket[key] = { trades: 0, wins: 0, pnl: 0 };
        bucket[key].trades++;
        if (isWin) bucket[key].wins++;
        bucket[key].pnl = parseFloat((bucket[key].pnl + pnl).toFixed(2));
      }
    }

    for (const bucket of [bySym, byMode, bySession]) {
      for (const k of Object.keys(bucket)) {
        const b = bucket[k];
        b.winRate = b.trades > 0 ? parseFloat(((b.wins / b.trades) * 100).toFixed(1)) : 0;
      }
    }

    res.json({ bySym, byMode, bySession, total: resolved.length });
  }));

  r.get('/calendar', wrap(async (req: Request, res: Response) => {
    const entries  = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const resolved = entries.filter(e => e.result && e.pnl != null);
    const byDay: Record<string, { pnl: number; trades: number; wins: number }> = {};

    for (const e of resolved) {
      const day = new Date(e.ts).toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { pnl: 0, trades: 0, wins: 0 };
      byDay[day].pnl    = parseFloat((byDay[day].pnl + (e.pnl ?? 0)).toFixed(2));
      byDay[day].trades++;
      if (e.result === 'win') byDay[day].wins++;
    }

    res.json({ calendar: byDay, days: Object.keys(byDay).length });
  }));

  // ── Org-level executive analytics (enterprise) ────────────────────────────

  /**
   * GET /api/analytics/retention
   * 30/60/90-day retention cohorts for the org.
   * Requires: analytics:read permission
   */
  r.get('/retention', requirePermission('analytics:read'), wrap(async (req: Request, res: Response) => {
    const tenantId = req.tenant!.id;
    const now      = new Date();

    // Session-based retention: count users with sessions in each window
    const windows = [
      { label: '7d',  days: 7 },
      { label: '30d', days: 30 },
      { label: '60d', days: 60 },
      { label: '90d', days: 90 },
    ];

    const totalUsers = await prisma.user.count({ where: { tenantId } });

    const retention: Record<string, any> = {};
    for (const w of windows) {
      const since = new Date(now.getTime() - w.days * 86_400_000);
      // Count users with journal activity in window as proxy for session activity
      const activeUsers = await prisma.journalEntry.groupBy({
        by:    ['userId'],
        where: { tenantId, createdAt: { gte: since } },
      });
      const active = activeUsers.length;
      retention[w.label] = {
        activeUsers:  active,
        totalUsers,
        retentionPct: totalUsers > 0 ? parseFloat(((active / totalUsers) * 100).toFixed(1)) : 0,
        window:       w.label,
      };
    }

    // Churn: users with zero journal activity in last 30 days
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const activeIn30 = await prisma.journalEntry.groupBy({
      by:    ['userId'],
      where: { tenantId, createdAt: { gte: since30 } },
    });
    const churnedUsers = totalUsers - activeIn30.length;

    res.json({
      retention,
      churn: {
        churnedUsers30d: churnedUsers,
        churnRate30d:    totalUsers > 0 ? parseFloat(((churnedUsers / totalUsers) * 100).toFixed(1)) : 0,
      },
      generatedAt: now.toISOString(),
    });
  }));

  /**
   * GET /api/analytics/behavioral
   * Behavioral intelligence signals: emotional trading, revenge trading, etc.
   * Requires: behavioral:read permission
   */
  r.get('/behavioral', requirePermission('behavioral:read'), wrap(async (req: Request, res: Response) => {
    const tenantId = req.tenant!.id;
    const days     = parseInt((req.query.days as string) ?? '7');
    const since    = new Date(Date.now() - days * 86_400_000);

    // Fetch recent journal entries for the org
    const entries = await prisma.journalEntry.findMany({
      where:   { tenantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select:  { userId: true, result: true, pnl: true, createdAt: true, sym: true, conviction: true },
    });

    // Group by user to detect patterns
    const byUser: Record<string, typeof entries> = {};
    for (const e of entries) {
      if (!byUser[e.userId]) byUser[e.userId] = [];
      byUser[e.userId].push(e);
    }

    const signals: Array<{
      userId: string;
      signalType: string;
      confidence: number;
      description: string;
      tradeCount: number;
    }> = [];

    for (const [userId, userEntries] of Object.entries(byUser)) {
      // Emotional trading: entry within 2 minutes of a loss (approximated by consecutive loss then fast next trade)
      let consecutiveLosses = 0;
      for (let i = 0; i < userEntries.length - 1; i++) {
        const curr = userEntries[i];
        const next = userEntries[i + 1];
        if (curr.result === 'loss') {
          consecutiveLosses++;
          const gapMs = new Date(next.createdAt).getTime() - new Date(curr.createdAt).getTime();
          if (gapMs < 2 * 60_000) {
            // Fast re-entry after loss = emotional trading signal
            signals.push({
              userId,
              signalType:  'emotional_trade',
              confidence:  Math.min(0.5 + (consecutiveLosses * 0.1), 0.95),
              description: `Re-entered within ${Math.round(gapMs / 1000)}s of a stop-out`,
              tradeCount:  consecutiveLosses,
            });
          }
        } else {
          consecutiveLosses = 0;
        }
      }

      // Revenge trading: look for conviction drop after losses (lower conviction on follow-up trades)
      const losses = userEntries.filter(e => e.result === 'loss');
      if (losses.length >= 2 && userEntries.length >= 4) {
        const avgConviction = userEntries
          .filter(e => e.conviction != null)
          .reduce((s, e) => s + (e.conviction ?? 0), 0) / userEntries.length;
        const lossConviction = losses
          .filter(e => e.conviction != null)
          .reduce((s, e) => s + (e.conviction ?? 0), 0) / Math.max(losses.length, 1);
        if (lossConviction < avgConviction * 0.7 && losses.length >= 3) {
          signals.push({
            userId,
            signalType:  'revenge_trade',
            confidence:  0.7,
            description: `${losses.length} consecutive losses with declining conviction`,
            tradeCount:  losses.length,
          });
        }
      }

      // Overtrading: > 10 trades/day
      const byDay: Record<string, number> = {};
      for (const e of userEntries) {
        const day = e.createdAt.toISOString().split('T')[0];
        byDay[day] = (byDay[day] ?? 0) + 1;
      }
      for (const [day, count] of Object.entries(byDay)) {
        if (count > 10) {
          signals.push({
            userId,
            signalType:  'overtrade',
            confidence:  Math.min(0.5 + (count - 10) * 0.05, 0.95),
            description: `${count} trades on ${day} (baseline: 10/day)`,
            tradeCount:  count,
          });
        }
      }
    }

    // Aggregate stats
    const signalCounts = signals.reduce((acc, s) => {
      acc[s.signalType] = (acc[s.signalType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const affectedUsers = new Set(signals.map(s => s.userId)).size;

    res.json({
      signals,
      summary: {
        totalSignals:  signals.length,
        affectedUsers,
        signalCounts,
        windowDays:    days,
      },
      generatedAt: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/analytics/engagement
   * DAU/WAU/MAU, session duration, engagement score.
   * Requires: analytics:read permission
   */
  r.get('/engagement', requirePermission('analytics:read'), wrap(async (req: Request, res: Response) => {
    const tenantId = req.tenant!.id;
    const now      = new Date();

    const [dau, wau, mau] = await Promise.all([
      prisma.journalEntry.groupBy({ by: ['userId'], where: { tenantId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
      prisma.journalEntry.groupBy({ by: ['userId'], where: { tenantId, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      prisma.journalEntry.groupBy({ by: ['userId'], where: { tenantId, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } }),
    ]);

    // Engagement score = composite of sessions × journal depth × AI interactions
    // Here proxied via journal entry count and average conviction
    const recentEntries = await prisma.journalEntry.findMany({
      where:  { tenantId, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      select: { conviction: true },
    });
    const avgConviction = recentEntries.length > 0
      ? recentEntries.reduce((s, e) => s + (e.conviction ?? 50), 0) / recentEntries.length
      : 0;

    const engagementScore = Math.min(
      (mau.length * 10) + (recentEntries.length * 0.5) + avgConviction,
      100,
    );

    res.json({
      dau:             dau.length,
      wau:             wau.length,
      mau:             mau.length,
      dauWauRatio:     wau.length > 0 ? parseFloat((dau.length / wau.length).toFixed(2)) : 0,
      wauMauRatio:     mau.length > 0 ? parseFloat((wau.length / mau.length).toFixed(2)) : 0,
      engagementScore: parseFloat(engagementScore.toFixed(1)),
      journalVolume30d: recentEntries.length,
      avgConviction:   parseFloat(avgConviction.toFixed(1)),
      generatedAt:     now.toISOString(),
    });
  }));

  /**
   * GET /api/analytics/insights
   * AI-generated weekly narrative insights for the org.
   * Requires: analytics:read permission
   */
  r.get('/insights', requirePermission('analytics:read'), wrap(async (req: Request, res: Response) => {
    const tenantId = req.tenant!.id;
    const since    = new Date(Date.now() - 7 * 86_400_000);

    const [entries, totalUsers] = await Promise.all([
      prisma.journalEntry.findMany({
        where:  { tenantId, createdAt: { gte: since } },
        select: { result: true, pnl: true, userId: true, sym: true, session: true },
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);

    const wins  = entries.filter(e => e.result === 'win').length;
    const total = entries.filter(e => e.result).length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const pnlSum = entries.reduce((s, e) => s + Number(e.pnl ?? 0), 0);
    const activeUsers = new Set(entries.map(e => e.userId)).size;
    const churnedCount = totalUsers - activeUsers;

    // Top symbol
    const symCounts: Record<string, number> = {};
    for (const e of entries) symCounts[e.sym] = (symCounts[e.sym] ?? 0) + 1;
    const topSym = Object.entries(symCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    const insights = [
      `Your org's 7-day win rate is ${winRate}% across ${total} resolved trades.`,
      `${activeUsers} of ${totalUsers} traders were active this week. ${churnedCount} traders had zero activity.`,
      `${topSym} was the most traded instrument (${symCounts[topSym] ?? 0} entries).`,
      pnlSum > 0
        ? `Aggregate PnL for the week: +${pnlSum.toFixed(2)} — positive week.`
        : `Aggregate PnL for the week: ${pnlSum.toFixed(2)} — review risk parameters.`,
    ];

    res.json({ insights, period: '7d', generatedAt: new Date().toISOString() });
  }));

  return r;
}
