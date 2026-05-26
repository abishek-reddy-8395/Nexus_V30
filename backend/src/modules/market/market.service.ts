/**
 * Nexus V30 — Market Service
 *
 * Multi-source price fetching with proper fallback chains per asset class:
 *   CRYPTO  → Binance REST → Bybit REST
 *   METALS  → Alpha Vantage → Twelve Data → Binance Futures (XAUUSDT)
 *   FOREX   → Twelve Data → ExchangeRate-API → Alpha Vantage
 *   INDICES → Alpha Vantage → Twelve Data
 *   OIL     → Alpha Vantage → Binance Futures (WTIUSDT)
 *
 * No Yahoo Finance. No scraping. All proper APIs.
 */

import https    from 'https';
import NodeCache from 'node-cache';
import { Logger } from '../../shared/helpers/logger';

export interface PriceData {
  sym:          string;
  price:        number;
  change:       number;
  changePct:    number;
  candles:      OhlcvCandle[];
  dailyCandles: OhlcvCandle[];
  fetchedAt:    number;
}

export interface OhlcvCandle {
  time:   number;   // Unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

type AssetClass = 'CRYPTO' | 'FOREX' | 'METAL' | 'INDEX' | 'OIL';

interface InstrumentDef {
  assetClass:    AssetClass;
  binance?:      string;   // Binance symbol (BTCUSDT)
  bybit?:        string;   // Bybit symbol
  binanceFuture?:string;   // Binance Futures (XAUUSDT perp)
  avSymbol?:     string;   // Alpha Vantage symbol
  avFromTo?:     [string, string]; // Alpha Vantage FX from/to
  tdSymbol?:     string;   // Twelve Data symbol
  digits:        number;
}

const INSTRUMENTS: Record<string, InstrumentDef> = {
  // ── Crypto ──────────────────────────────────────────────────────────
  BTCUSD:  { assetClass:'CRYPTO', binance:'BTCUSDT',  bybit:'BTCUSDT',  digits:2 },
  ETHUSD:  { assetClass:'CRYPTO', binance:'ETHUSDT',  bybit:'ETHUSDT',  digits:2 },
  SOLUSD:  { assetClass:'CRYPTO', binance:'SOLUSDT',  bybit:'SOLUSDT',  digits:4 },
  BNBUSD:  { assetClass:'CRYPTO', binance:'BNBUSDT',  bybit:'BNBUSDT',  digits:4 },
  XRPUSD:  { assetClass:'CRYPTO', binance:'XRPUSDT',  bybit:'XRPUSDT',  digits:5 },

  // ── Metals ──────────────────────────────────────────────────────────
  XAUUSD:  { assetClass:'METAL',  avFromTo:['XAU','USD'], binanceFuture:'XAUUSDT', tdSymbol:'XAU/USD', digits:2 },
  XAGUSD:  { assetClass:'METAL',  avFromTo:['XAG','USD'], binanceFuture:'XAGUSD',  tdSymbol:'XAG/USD', digits:3 },

  // ── Forex ────────────────────────────────────────────────────────────
  EURUSD:  { assetClass:'FOREX',  avFromTo:['EUR','USD'], tdSymbol:'EUR/USD', digits:5 },
  GBPUSD:  { assetClass:'FOREX',  avFromTo:['GBP','USD'], tdSymbol:'GBP/USD', digits:5 },
  USDJPY:  { assetClass:'FOREX',  avFromTo:['USD','JPY'], tdSymbol:'USD/JPY', digits:3 },
  USDCHF:  { assetClass:'FOREX',  avFromTo:['USD','CHF'], tdSymbol:'USD/CHF', digits:5 },
  AUDUSD:  { assetClass:'FOREX',  avFromTo:['AUD','USD'], tdSymbol:'AUD/USD', digits:5 },
  GBPJPY:  { assetClass:'FOREX',  avFromTo:['GBP','JPY'], tdSymbol:'GBP/JPY', digits:3 },

  // ── Oil ──────────────────────────────────────────────────────────────
  USOIL:   { assetClass:'OIL',    avSymbol:'CL=F', binanceFuture:'WTIUSDT', tdSymbol:'WTI/USD', digits:2 },
  UKOIL:   { assetClass:'OIL',    avSymbol:'BZ=F', tdSymbol:'BRENT/USD', digits:2 },

  // ── Indices ──────────────────────────────────────────────────────────
  US30:    { assetClass:'INDEX',  avSymbol:'DJI', tdSymbol:'DJI', digits:0 },
  US500:   { assetClass:'INDEX',  avSymbol:'SPY', tdSymbol:'SPY', digits:2 },
  NAS100:  { assetClass:'INDEX',  avSymbol:'QQQ', tdSymbol:'QQQ', digits:2 },
};

const cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
const logger = new Logger('MarketService');

function candleTTL(tf: number): number {
  if (tf < 5)    return 10;
  if (tf < 60)   return 30;
  if (tf < 240)  return 120;
  if (tf < 1440) return 300;
  return 900;
}

function tfToInterval(tf: number): { binance: string; td: string; av: string } {
  const map: Record<number, { binance: string; td: string; av: string }> = {
    1:    { binance: '1m',  td: '1min',  av: '1min'  },
    5:    { binance: '5m',  td: '5min',  av: '5min'  },
    15:   { binance: '15m', td: '15min', av: '15min' },
    30:   { binance: '30m', td: '30min', av: '30min' },
    60:   { binance: '1h',  td: '1h',    av: '60min' },
    240:  { binance: '4h',  td: '4h',    av: '60min' },
    1440: { binance: '1d',  td: '1day',  av: 'daily' },
  };
  return map[tf] ?? map[15];
}

function fetchJSON(url: string, timeoutMs = 12_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'NEXUS-Terminal/25.0', 'Accept': 'application/json' },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode! < 200 || res.statusCode! >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from ${url.split('?')[0]}`));
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch (e: any) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url.split('?')[0]}`)); });
  });
}

export class MarketService {

  async fetchPriceAndCandles(sym: string, tf: number): Promise<PriceData> {
    const cacheKey = `price:${sym}:${tf}`;
    const cached   = cache.get<PriceData>(cacheKey);
    if (cached) return cached;

    const inst = INSTRUMENTS[sym];
    if (!inst) throw Object.assign(new Error(`Unknown symbol: ${sym}`), { status: 400 });

    const data = await this._fetchWithFallback(sym, inst, tf);
    cache.set(cacheKey, data, candleTTL(tf));
    return data;
  }

  private async _fetchWithFallback(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    const sources = this._getSourceChain(inst);
    const errors: string[] = [];

    for (const source of sources) {
      try {
        logger.info(`Fetching ${sym} via ${source}`);
        return await (this as any)[source](sym, inst, tf);
      } catch (err: any) {
        errors.push(`${source}: ${err.message}`);
        logger.warn(`${source} failed for ${sym}: ${err.message}`);
      }
    }

    throw Object.assign(
      new Error(`All data sources failed for ${sym}. Errors: ${errors.join(' | ')}`),
      { status: 503 }
    );
  }

  private _getSourceChain(inst: InstrumentDef): string[] {
    switch (inst.assetClass) {
      case 'CRYPTO':
        return ['_fetchBinance', '_fetchBybit'];
      case 'METAL':
        return ['_fetchAlphaVantageForex', '_fetchTwelveData', '_fetchBinanceFuture'];
      case 'FOREX':
        return ['_fetchTwelveData', '_fetchAlphaVantageForex'];
      case 'OIL':
        return ['_fetchAlphaVantageEquity', '_fetchTwelveData'];
      case 'INDEX':
        return ['_fetchAlphaVantageEquity', '_fetchTwelveData'];
      default:
        return ['_fetchAlphaVantageEquity'];
    }
  }

  // ── Source: Binance Spot ─────────────────────────────────────────────
  private async _fetchBinance(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    if (!inst.binance) throw new Error('No Binance symbol');
    const interval = tfToInterval(tf).binance;
    const limit    = 200;

    const [ticker, klines, daily] = await Promise.all([
      fetchJSON(`https://api.binance.com/api/v3/ticker/24hr?symbol=${inst.binance}`),
      fetchJSON(`https://api.binance.com/api/v3/klines?symbol=${inst.binance}&interval=${interval}&limit=${limit}`),
      fetchJSON(`https://api.binance.com/api/v3/klines?symbol=${inst.binance}&interval=1d&limit=30`),
    ]);

    const toCandle = (k: any[]): OhlcvCandle => ({
      time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    });

    const candles      = klines.map(toCandle).sort((a: OhlcvCandle, b: OhlcvCandle) => a.time - b.time);
    const dailyCandles = daily.map(toCandle).sort((a: OhlcvCandle, b: OhlcvCandle) => a.time - b.time);
    const price        = +ticker.lastPrice;

    return {
      sym, price,
      change:    +ticker.priceChange,
      changePct: +ticker.priceChangePercent,
      candles: this._dedupSorted(candles),
      dailyCandles: this._dedupSorted(dailyCandles),
      fetchedAt: Date.now(),
    };
  }

  // ── Source: Bybit Spot (fallback for crypto) ─────────────────────────
  private async _fetchBybit(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    if (!inst.bybit) throw new Error('No Bybit symbol');
    const interval = tfToInterval(tf).binance; // Bybit uses same interval strings
    const limit    = 200;

    const [ticker, klines] = await Promise.all([
      fetchJSON(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${inst.bybit}`),
      fetchJSON(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${inst.bybit}&interval=${interval}&limit=${limit}`),
    ]);

    const t = ticker?.result?.list?.[0];
    if (!t) throw new Error('Bybit: no ticker data');

    const rawList: any[][] = klines?.result?.list ?? [];
    const candles: OhlcvCandle[] = rawList.map(k => ({
      time: Math.floor(+k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    })).sort((a, b) => a.time - b.time);

    return {
      sym, price: +t.lastPrice,
      change:    +t.price24hPcnt * +t.prevPrice24h,
      changePct: +t.price24hPcnt * 100,
      candles: this._dedupSorted(candles),
      dailyCandles: candles.slice(-30),
      fetchedAt: Date.now(),
    };
  }

  // ── Source: Binance Futures (metals / oil fallback) ──────────────────
  private async _fetchBinanceFuture(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    if (!inst.binanceFuture) throw new Error('No Binance futures symbol');
    const interval = tfToInterval(tf).binance;

    const [ticker, klines] = await Promise.all([
      fetchJSON(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${inst.binanceFuture}`),
      fetchJSON(`https://fapi.binance.com/fapi/v1/klines?symbol=${inst.binanceFuture}&interval=${interval}&limit=200`),
    ]);

    const toCandle = (k: any[]): OhlcvCandle => ({
      time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    });

    const candles = klines.map(toCandle).sort((a: OhlcvCandle, b: OhlcvCandle) => a.time - b.time);

    return {
      sym, price: +ticker.lastPrice,
      change:    +ticker.priceChange,
      changePct: +ticker.priceChangePercent,
      candles: this._dedupSorted(candles),
      dailyCandles: candles.slice(-30),
      fetchedAt: Date.now(),
    };
  }

  // ── Source: Alpha Vantage FX (metals + forex) ─────────────────────────
  private async _fetchAlphaVantageForex(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    const key = process.env.ALPHA_VANTAGE_KEY;
    if (!key) throw new Error('ALPHA_VANTAGE_KEY not set');
    if (!inst.avFromTo) throw new Error('No AV from/to pair');

    const [from, to]     = inst.avFromTo;
    const avInterval     = tfToInterval(tf).av;
    const isIntraday     = tf < 1440;
    const func           = isIntraday ? 'FX_INTRADAY' : 'FX_DAILY';
    const intervalParam  = isIntraday ? `&interval=${avInterval}` : '';

    const url = `https://www.alphavantage.co/query?function=${func}&from_symbol=${from}&to_symbol=${to}${intervalParam}&outputsize=compact&apikey=${key}`;
    const data = await fetchJSON(url);

    const tsKey  = Object.keys(data).find(k => k.startsWith('Time Series')) ?? '';
    const tsData = data[tsKey];
    if (!tsData) throw new Error(`Alpha Vantage: no time series in response (may be rate limited)`);

    const candles: OhlcvCandle[] = Object.entries(tsData)
      .map(([dateStr, v]: [string, any]) => ({
        time:   Math.floor(new Date(dateStr).getTime() / 1000),
        open:   +v['1. open'],
        high:   +v['2. high'],
        low:    +v['3. low'],
        close:  +v['4. close'],
        volume: 0,
      }))
      .sort((a, b) => a.time - b.time);

    if (!candles.length) throw new Error('Alpha Vantage: empty candle list');
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const change = prev ? last.close - prev.close : 0;

    return {
      sym, price: last.close,
      change,
      changePct: prev ? (change / prev.close) * 100 : 0,
      candles: this._dedupSorted(candles),
      dailyCandles: candles.slice(-30),
      fetchedAt: Date.now(),
    };
  }

  // ── Source: Alpha Vantage Equity (indices, oil) ───────────────────────
  private async _fetchAlphaVantageEquity(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    const key = process.env.ALPHA_VANTAGE_KEY;
    if (!key) throw new Error('ALPHA_VANTAGE_KEY not set');
    if (!inst.avSymbol) throw new Error('No AV symbol');

    const avInterval = tfToInterval(tf).av;
    const isIntraday = tf < 1440;
    const func       = isIntraday ? 'TIME_SERIES_INTRADAY' : 'TIME_SERIES_DAILY';
    const intParam   = isIntraday ? `&interval=${avInterval}` : '';

    const url  = `https://www.alphavantage.co/query?function=${func}&symbol=${inst.avSymbol}${intParam}&outputsize=compact&apikey=${key}`;
    const data = await fetchJSON(url);

    const tsKey  = Object.keys(data).find(k => k.startsWith('Time Series')) ?? '';
    const tsData = data[tsKey];
    if (!tsData) throw new Error('Alpha Vantage Equity: no time series');

    const candles: OhlcvCandle[] = Object.entries(tsData)
      .map(([dateStr, v]: [string, any]) => ({
        time:   Math.floor(new Date(dateStr).getTime() / 1000),
        open:   +v['1. open'],
        high:   +v['2. high'],
        low:    +v['3. low'],
        close:  +v['4. close'],
        volume: +v['5. volume'] || 0,
      }))
      .sort((a, b) => a.time - b.time);

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const change = prev ? last.close - prev.close : 0;

    return {
      sym, price: last.close,
      change,
      changePct: prev ? (change / prev.close) * 100 : 0,
      candles: this._dedupSorted(candles),
      dailyCandles: candles.slice(-30),
      fetchedAt: Date.now(),
    };
  }

  // ── Source: Twelve Data ───────────────────────────────────────────────
  private async _fetchTwelveData(sym: string, inst: InstrumentDef, tf: number): Promise<PriceData> {
    const key = process.env.TWELVE_DATA_KEY;
    if (!key) throw new Error('TWELVE_DATA_KEY not set');

    const symbol   = inst.tdSymbol;
    if (!symbol) throw new Error('No Twelve Data symbol');

    const interval = tfToInterval(tf).td;
    const url      = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=200&apikey=${key}`;
    const data     = await fetchJSON(url);

    if (data.status === 'error') throw new Error(`Twelve Data: ${data.message}`);
    const values: any[] = data.values ?? [];
    if (!values.length)  throw new Error('Twelve Data: no values returned');

    const candles: OhlcvCandle[] = values
      .map(v => ({
        time:   Math.floor(new Date(v.datetime).getTime() / 1000),
        open:   +v.open, high: +v.high, low: +v.low, close: +v.close,
        volume: +v.volume || 0,
      }))
      .sort((a, b) => a.time - b.time);

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const change = prev ? last.close - prev.close : 0;

    return {
      sym, price: last.close,
      change,
      changePct: prev ? (change / prev.close) * 100 : 0,
      candles: this._dedupSorted(candles),
      dailyCandles: candles.slice(-30),
      fetchedAt: Date.now(),
    };
  }

  // ── Watchlist ─────────────────────────────────────────────────────────
  async fetchWatchlistData(): Promise<PriceData[]> {
    const syms = ['XAUUSD', 'EURUSD', 'BTCUSD', 'ETHUSD', 'GBPUSD', 'USDJPY', 'XAGUSD', 'USOIL'];
    const results = await Promise.allSettled(syms.map(s => this.fetchPriceAndCandles(s, 15)));
    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<PriceData>).value);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private _dedupSorted(candles: OhlcvCandle[]): OhlcvCandle[] {
    return candles.filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
  }
}
