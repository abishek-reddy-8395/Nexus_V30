/**
 * Nexus V30 — Economic Calendar Routes (full implementation)
 *
 * GET /api/calendar              — all events for current week
 * GET /api/calendar/upcoming     — next 5 high-impact events
 * GET /api/calendar/today        — today's events only
 *
 * Data source: Forexfactory RSS or hardcoded weekly schedule.
 * Phase 4: replace with real calendar API (Investing.com, ForexFactory).
 */
import { Router, Request, Response } from 'express';

// Hard-coded recurring high-impact events for dev (replaced by real API in prod)
const RECURRING_EVENTS = [
  { id: 'nfp',    name: 'Non-Farm Payrolls',       currency: 'USD', impact: 'high',   utcHour: 12, utcMinute: 30, dayOfMonth: null, weekday: 5, weekOfMonth: 1 },
  { id: 'fomc',   name: 'FOMC Rate Decision',       currency: 'USD', impact: 'high',   utcHour: 18, utcMinute:  0, dayOfMonth: null, weekday: 3, weekOfMonth: null },
  { id: 'ecb',    name: 'ECB Rate Decision',         currency: 'EUR', impact: 'high',   utcHour: 12, utcMinute: 15, dayOfMonth: null, weekday: 4, weekOfMonth: null },
  { id: 'boe',    name: 'BoE Rate Decision',         currency: 'GBP', impact: 'high',   utcHour: 11, utcMinute:  0, dayOfMonth: null, weekday: 4, weekOfMonth: null },
  { id: 'cpi_us', name: 'US CPI (YoY)',              currency: 'USD', impact: 'high',   utcHour: 12, utcMinute: 30, dayOfMonth: null, weekday: 3, weekOfMonth: 2 },
  { id: 'gdp_us', name: 'US GDP (QoQ)',              currency: 'USD', impact: 'high',   utcHour: 12, utcMinute: 30, dayOfMonth: null, weekday: 4, weekOfMonth: 4 },
  { id: 'pmi_us', name: 'US ISM Manufacturing PMI',  currency: 'USD', impact: 'medium', utcHour: 14, utcMinute:  0, dayOfMonth: null, weekday: 1, weekOfMonth: 1 },
  { id: 'eur_pmi',name: 'EUR Manufacturing PMI',     currency: 'EUR', impact: 'medium', utcHour:  9, utcMinute:  0, dayOfMonth: null, weekday: 1, weekOfMonth: 1 },
];

function getWeekEvents(date: Date = new Date()): any[] {
  const startOfWeek = new Date(date);
  startOfWeek.setUTCDate(date.getUTCDate() - date.getUTCDay() + 1);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const events: any[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(startOfWeek);
    day.setUTCDate(startOfWeek.getUTCDate() + d);
    const weekday = day.getUTCDay() || 7; // 1=Mon 7=Sun

    for (const ev of RECURRING_EVENTS) {
      if (ev.weekday === weekday) {
        const evDate = new Date(day);
        evDate.setUTCHours(ev.utcHour, ev.utcMinute, 0, 0);
        events.push({
          id:          `${ev.id}_${evDate.toISOString().split('T')[0]}`,
          name:        ev.name,
          currency:    ev.currency,
          impact:      ev.impact,
          time:        evDate.toISOString(),
          utcTime:     `${String(ev.utcHour).padStart(2,'0')}:${String(ev.utcMinute).padStart(2,'0')}`,
          forecast:    null,
          previous:    null,
          actual:      null,
        });
      }
    }
  }
  return events.sort((a, b) => a.time.localeCompare(b.time));
}

export function registerCalendarRoutes(): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const events = getWeekEvents();
    res.json({ events, week: 'current', count: events.length });
  });

  r.get('/upcoming', (req: Request, res: Response) => {
    const impact  = req.query.impact as string | undefined;
    const now     = new Date();
    const events  = getWeekEvents()
      .filter(e => new Date(e.time) > now)
      .filter(e => !impact || e.impact === impact)
      .slice(0, 5);
    res.json({ events, count: events.length });
  });

  r.get('/today', (_req, res) => {
    const now    = new Date();
    const events = getWeekEvents().filter(e => {
      const evDate = new Date(e.time);
      return evDate.getUTCFullYear() === now.getUTCFullYear() &&
             evDate.getUTCMonth()    === now.getUTCMonth()    &&
             evDate.getUTCDate()     === now.getUTCDate();
    });
    res.json({ events, date: now.toISOString().split('T')[0], count: events.length });
  });

  return r;
}
