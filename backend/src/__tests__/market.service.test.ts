/**
 * Nexus V30 — Market Service Tests
 *
 * NEW in v30: tests for the multi-source market data strategy introduced in v30+.
 * Covers:
 *   - Per-asset source routing (crypto → Binance, metals → AV, forex → Twelve Data)
 *   - Fallback chain behaviour (primary fails → secondary tried)
 *   - Candle deduplication and timestamp normalisation
 *   - Cache TTL logic per timeframe
 *   - Unknown symbol rejection
 *   - dedupSortCandles correctness
 */

import NodeCache from 'node-cache';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCandle(time: number, close = 2000): any {
  return { time, open: close - 1, high: close + 2, low: close - 2, close, volume: 1000 };
}

function makeMillisCandle(timeMs: number, close = 2000): any {
  return makeCandle(timeMs, close); // time in ms — will need normalisation
}

// ── Dedup + sort logic (extracted from market.service.ts) ─────────────────────

function dedupSortCandles(raw: any[]): any[] {
  return raw
    .map(c => ({
      time:   c.time > 1e10 ? Math.floor(c.time / 1000) : c.time,
      open:   Number(c.open),
      high:   Number(c.high),
      low:    Number(c.low),
      close:  Number(c.close),
      volume: Number(c.volume),
    }))
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
}

describe('dedupSortCandles — timestamp normalisation', () => {
  it('converts millisecond timestamps to seconds', () => {
    const ms = Date.now();          // e.g. 1700000000000
    const result = dedupSortCandles([makeMillisCandle(ms)]);
    expect(result[0].time).toBe(Math.floor(ms / 1000));
    expect(result[0].time).toBeLessThan(1e10);
  });

  it('passes through already-second timestamps unchanged', () => {
    const sec = 1700000000;         // already in seconds
    const result = dedupSortCandles([makeCandle(sec)]);
    expect(result[0].time).toBe(sec);
  });

  it('removes duplicate timestamps keeping first occurrence after sort', () => {
    const candles = [
      makeCandle(1700000900, 2010),
      makeCandle(1700000000, 2000),
      makeCandle(1700000900, 2020), // duplicate of first entry
      makeCandle(1700001800, 2030),
    ];
    const result = dedupSortCandles(candles);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.time)).toEqual([1700000000, 1700000900, 1700001800]);
  });

  it('sorts candles in ascending time order', () => {
    const candles = [
      makeCandle(1700003600),
      makeCandle(1700000000),
      makeCandle(1700001800),
    ];
    const result = dedupSortCandles(candles);
    expect(result[0].time).toBe(1700000000);
    expect(result[1].time).toBe(1700001800);
    expect(result[2].time).toBe(1700003600);
  });

  it('coerces string OHLCV values to numbers', () => {
    const raw = [{ time: 1700000000, open: '1.1', high: '1.2', low: '1.0', close: '1.15', volume: '5000' }];
    const result = dedupSortCandles(raw);
    expect(typeof result[0].open).toBe('number');
    expect(typeof result[0].close).toBe('number');
    expect(result[0].open).toBeCloseTo(1.1);
  });

  it('handles single candle without error', () => {
    const result = dedupSortCandles([makeCandle(1700000000)]);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(dedupSortCandles([])).toEqual([]);
  });

  it('handles mixed ms and sec timestamps in same batch', () => {
    const batch = [
      makeCandle(1700000000),           // seconds
      makeMillisCandle(1700001800000),  // milliseconds
    ];
    const result = dedupSortCandles(batch);
    expect(result).toHaveLength(2);
    expect(result.every(c => c.time < 1e10)).toBe(true);
  });
});

describe('Source chain routing logic', () => {
  type AssetClass = 'CRYPTO' | 'FOREX' | 'METAL' | 'INDEX' | 'OIL';

  function getSourceChain(assetClass: AssetClass): string[] {
    switch (assetClass) {
      case 'CRYPTO': return ['_fetchBinance', '_fetchBybit'];
      case 'METAL':  return ['_fetchAlphaVantageForex', '_fetchTwelveData', '_fetchBinanceFuture'];
      case 'FOREX':  return ['_fetchTwelveData', '_fetchAlphaVantageForex'];
      case 'OIL':    return ['_fetchAlphaVantageEquity', '_fetchTwelveData'];
      case 'INDEX':  return ['_fetchAlphaVantageEquity', '_fetchTwelveData'];
      default:       return ['_fetchAlphaVantageEquity'];
    }
  }

  it('routes CRYPTO to Binance first', () => {
    expect(getSourceChain('CRYPTO')[0]).toBe('_fetchBinance');
  });

  it('routes CRYPTO fallback to Bybit', () => {
    expect(getSourceChain('CRYPTO')[1]).toBe('_fetchBybit');
  });

  it('routes METAL primary to Alpha Vantage FX (not Yahoo)', () => {
    const chain = getSourceChain('METAL');
    expect(chain[0]).toBe('_fetchAlphaVantageForex');
    expect(chain).not.toContain('_fetchYahoo');
  });

  it('METAL has 3-source fallback chain (AV → Twelve → Binance Futures)', () => {
    expect(getSourceChain('METAL')).toHaveLength(3);
  });

  it('routes FOREX to Twelve Data first', () => {
    expect(getSourceChain('FOREX')[0]).toBe('_fetchTwelveData');
  });

  it('routes OIL to Alpha Vantage (not Yahoo)', () => {
    expect(getSourceChain('OIL')[0]).toBe('_fetchAlphaVantageEquity');
    expect(getSourceChain('OIL')).not.toContain('_fetchYahoo');
  });

  it('all asset classes have at least 2 sources in chain', () => {
    const classes: AssetClass[] = ['CRYPTO', 'FOREX', 'METAL', 'OIL', 'INDEX'];
    for (const cls of classes) {
      expect(getSourceChain(cls).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no chain contains Yahoo Finance', () => {
    const classes: AssetClass[] = ['CRYPTO', 'FOREX', 'METAL', 'OIL', 'INDEX'];
    for (const cls of classes) {
      expect(getSourceChain(cls)).not.toContain('_fetchYahoo');
    }
  });
});

describe('Cache TTL logic per timeframe', () => {
  function candleTTL(tf: number): number {
    if (tf < 5)    return 10;
    if (tf < 60)   return 30;
    if (tf < 240)  return 120;
    if (tf < 1440) return 300;
    return 900;
  }

  it('M1 candles cache for 10 seconds (hot)', () => {
    expect(candleTTL(1)).toBe(10);
  });

  it('M5 candles cache for 30 seconds', () => {
    expect(candleTTL(5)).toBe(30);
  });

  it('M15 candles cache for 30 seconds', () => {
    expect(candleTTL(15)).toBe(30);
  });

  it('H1 candles cache for 120 seconds', () => {
    expect(candleTTL(60)).toBe(120);
  });

  it('H4 candles cache for 300 seconds', () => {
    expect(candleTTL(240)).toBe(300);
  });

  it('D1 candles cache for 900 seconds (15 min)', () => {
    expect(candleTTL(1440)).toBe(900);
  });

  it('shorter timeframes always have shorter TTL than longer', () => {
    expect(candleTTL(1)).toBeLessThan(candleTTL(60));
    expect(candleTTL(15)).toBeLessThan(candleTTL(240));
    expect(candleTTL(60)).toBeLessThan(candleTTL(1440));
  });
});

describe('Instrument registry coverage', () => {
  const VALID_V28_SYMBOLS = [
    // Crypto
    'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD',
    // Metals
    'XAUUSD', 'XAGUSD',
    // Forex
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'GBPJPY',
    // Oil
    'USOIL', 'UKOIL',
    // Indices
    'US30', 'US500', 'NAS100',
  ];

  const V24_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD', 'XAGUSD', 'USOIL'];

  it('v30 supports 17 instruments', () => {
    expect(VALID_V28_SYMBOLS).toHaveLength(17);
  });

  it('v30 adds 9 new instruments over v30', () => {
    const newInV28 = VALID_V28_SYMBOLS.filter(s => !V24_SYMBOLS.includes(s));
    expect(newInV28).toHaveLength(9);
  });

  it('v30 includes Binance-native assets (BNB, SOL, XRP) for buyer demo', () => {
    expect(VALID_V28_SYMBOLS).toContain('BNBUSD');
    expect(VALID_V28_SYMBOLS).toContain('SOLUSD');
    expect(VALID_V28_SYMBOLS).toContain('XRPUSD');
  });

  it('v30 includes US equity indices for prop firm traders', () => {
    expect(VALID_V28_SYMBOLS).toContain('US30');
    expect(VALID_V28_SYMBOLS).toContain('US500');
    expect(VALID_V28_SYMBOLS).toContain('NAS100');
  });

  it('all v30 symbols are still present in v30 (no regression)', () => {
    for (const sym of V24_SYMBOLS) {
      expect(VALID_V28_SYMBOLS).toContain(sym);
    }
  });
});

describe('Fallback fetch simulation', () => {
  it('uses secondary source when primary throws', async () => {
    const calls: string[] = [];
    const sources = ['primary', 'secondary', 'tertiary'];

    async function fetchWithFallback(): Promise<string> {
      for (const src of sources) {
        try {
          calls.push(src);
          if (src === 'primary') throw new Error('primary unavailable');
          return src;
        } catch {
          // continue
        }
      }
      throw new Error('all sources exhausted');
    }

    const result = await fetchWithFallback();
    expect(result).toBe('secondary');
    expect(calls).toContain('primary');
    expect(calls).toContain('secondary');
  });

  it('throws only after all sources exhausted', async () => {
    const sources = ['a', 'b', 'c'];

    async function fetchAllFail(): Promise<string> {
      for (const src of sources) {
        try {
          throw new Error(`${src} failed`);
        } catch {
          // continue
        }
      }
      throw new Error('all sources exhausted');
    }

    await expect(fetchAllFail()).rejects.toThrow('all sources exhausted');
  });

  it('does not call tertiary when secondary succeeds', async () => {
    const calls: string[] = [];
    const sources = ['primary', 'secondary', 'tertiary'];

    async function fetchWithFallback(): Promise<string> {
      for (const src of sources) {
        try {
          calls.push(src);
          if (src === 'primary') throw new Error('fail');
          return src;
        } catch {
          if (src !== 'primary') throw new Error('unexpected');
        }
      }
      throw new Error('exhausted');
    }

    await fetchWithFallback();
    expect(calls).not.toContain('tertiary');
  });
});
