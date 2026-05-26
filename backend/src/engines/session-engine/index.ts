/**
 * Nexus V30 — Session Engine
 *
 * Trading session detection, killzone identification, emotional score
 * computation, and order book simulation. Server-side only.
 *
 * v2 equivalent: sessionService.js
 * v3: typed, extracted into engine layer, multi-timezone aware.
 */

export type SessionName = 'SYDNEY' | 'ASIA' | 'LONDON' | 'NEW YORK' | 'LONDON/NY' | 'OFF';

export interface SessionInfo {
  name:       SessionName;
  weight:     number;  // 0.4–1.5
  vol:        'Low' | 'Moderate' | 'High' | 'Very High';
  killzone:   boolean;
  overlap:    boolean;
  inKillzone: boolean;
  kzName:     string | null;
  utcHour:    number;
  utcMinute:  number;
  utcTime:    string;
}

interface SessionDef {
  id:       string;
  openUTC:  number;
  closeUTC: number;
  weight:   number;
  vol:      SessionInfo['vol'];
}

const SESSIONS: Record<string, SessionDef> = {
  SYDNEY:    { id: 'sydney',   openUTC: 22, closeUTC: 7,  weight: 0.4, vol: 'Low'      },
  ASIA:      { id: 'asia',     openUTC: 0,  closeUTC: 9,  weight: 0.5, vol: 'Low'      },
  LONDON:    { id: 'london',   openUTC: 7,  closeUTC: 16, weight: 1.2, vol: 'High'     },
  NEW_YORK:  { id: 'newyork',  openUTC: 12, closeUTC: 21, weight: 1.2, vol: 'High'     },
};

const KILLZONES = [
  { name: 'LONDON_OPEN',  startUTC: 7,  endUTC: 9  },
  { name: 'NY_OPEN',      startUTC: 12, endUTC: 14 },
  { name: 'LONDON_CLOSE', startUTC: 15, endUTC: 16 },
  { name: 'ASIA_OPEN',    startUTC: 0,  endUTC: 2  },
];

function inRange(h: number, open: number, close: number): boolean {
  return close < open ? h >= open || h < close : h >= open && h < close;
}

export class SessionEngine {
  getCurrent(): SessionInfo {
    const now  = new Date();
    const h    = now.getUTCHours();
    const m    = now.getUTCMinutes();

    const londonActive = inRange(h, 7, 16);
    const nyActive     = inRange(h, 12, 21);
    const asiaActive   = inRange(h, 0, 9);
    const sydActive    = inRange(h, 22, 7);
    const overlap      = londonActive && nyActive;

    let name:    SessionName = 'OFF';
    let weight  = 0.5;
    let vol:    SessionInfo['vol'] = 'Low';
    let killzone = false;

    if      (overlap)      { name = 'LONDON/NY';  weight = 1.5; vol = 'Very High'; killzone = true; }
    else if (londonActive) { name = 'LONDON';     weight = 1.2; vol = 'High';      killzone = true; }
    else if (nyActive)     { name = 'NEW YORK';   weight = 1.2; vol = 'High';      killzone = true; }
    else if (asiaActive)   { name = 'ASIA';       weight = 0.5; vol = 'Low';       killzone = false; }
    else if (sydActive)    { name = 'SYDNEY';     weight = 0.4; vol = 'Low';       killzone = false; }

    const kz        = KILLZONES.find(k => inRange(h, k.startUTC, k.endUTC));
    const inKillzone = killzone && !!kz;

    return {
      name, weight, vol, killzone, overlap, inKillzone,
      kzName:    kz?.name ?? null,
      utcHour:   h,
      utcMinute: m,
      utcTime:   `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
    };
  }

  getSessionBadges(): Array<{ id: string; label: string; open: boolean }> {
    const h = new Date().getUTCHours();
    return [
      { id: 'sydney',  label: 'SYD', open: inRange(h, 22, 7)  },
      { id: 'asia',    label: 'TKY', open: inRange(h, 0,  9)  },
      { id: 'london',  label: 'LON', open: inRange(h, 7,  16) },
      { id: 'newyork', label: 'NYC', open: inRange(h, 12, 21) },
    ];
  }

  getClock(): { utc: string; dayProgress: number; session: string; timestamp: string } {
    const now  = new Date();
    const h    = now.getUTCHours();
    const m    = now.getUTCMinutes();
    const s    = now.getUTCSeconds();
    return {
      utc:         `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
      dayProgress: ((h * 60 + m) / 1440) * 100,
      session:     this.getCurrent().name,
      timestamp:   now.toISOString(),
    };
  }

  computeEmotionalScore(entries: any[]): number {
    if (!entries?.length) return 5.0;
    const recent = entries.slice(-20);
    const wins   = recent.filter(e => e.result === 'win').length;
    const total  = recent.filter(e => e.result).length;
    if (!total)  return 5.0;
    const wr     = wins / total;
    return parseFloat((wr * 10).toFixed(1));
  }

  generateOrderBook(sym: string, price: number): { bids: any[]; asks: any[]; spread: number; bidVol: number; askVol: number } {
    // Seeded RNG — deterministic per minute (same as v2)
    const seed  = Math.floor(Date.now() / 60_000);
    const rng   = (i: number) => Math.abs(Math.sin(seed * 9301 + i * 49297) * 233) % 1;

    const digits = sym.includes('USD') && !sym.includes('JPY') ? 2 : 5;
    const step   = Math.pow(10, -digits);

    const bids = Array.from({ length: 10 }, (_, i) => ({
      price:  parseFloat((price - step * (i + 1)).toFixed(digits)),
      volume: Math.round(rng(i)       * 500 + 50),
    }));
    const asks = Array.from({ length: 10 }, (_, i) => ({
      price:  parseFloat((price + step * (i + 1)).toFixed(digits)),
      volume: Math.round(rng(i + 10) * 500 + 50),
    }));

    const bidVol = bids.reduce((s, b) => s + b.volume, 0);
    const askVol = asks.reduce((s, a) => s + a.volume, 0);

    return { bids, asks, spread: step, bidVol, askVol };
  }
}
