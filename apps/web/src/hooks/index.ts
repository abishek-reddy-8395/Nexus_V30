/**
 * Nexus V30 — React Hooks
 * Domain hooks that wrap API calls and state management.
 * Frontend is pure render layer — hooks only fetch, cache, and dispatch.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  nexusEngine, nexusMarket, nexusSession, nexusScanner, nexusRisk,
  nexusJournal, nexusAlerts, nexusPortfolio, nexusAnalytics,
} from '../services/api.client';
import { useEngineStore, useMarketStore, useScannerStore, useUIStore } from '../state/store';

// ── useEngine ─────────────────────────────────────────────────────────
export function useEngine() {
  const { analysis, loading, error, setAnalysis, setLoading, setError } = useEngineStore();
  const { sym, tf } = useMarketStore();
  const { mode }    = useUIStore();

  const runAnalysis = useCallback(async (
    overrideSym?:     string,
    overrideTf?:      number,
    overrideMode?:    string,
    overrideProfile?: 'retail' | 'institutional',
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await nexusEngine.analyze(
        overrideSym     ?? sym,
        overrideTf      ?? tf,
        overrideMode    ?? mode,
        overrideProfile ?? 'retail',
      );
      setAnalysis(result);
      return result;
    } catch (err: any) {
      setError(err.error ?? err.message ?? 'Analysis failed');
      throw err;
    }
  }, [sym, tf, mode, setAnalysis, setLoading, setError]);

  return { analysis, loading, error, runAnalysis };
}

// ── useMarket ─────────────────────────────────────────────────────────
export function useMarket() {
  const { sym, tf, price, candles, setSym, setTf, setPrice, setCandles } = useMarketStore();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchPrice = useCallback(async (s?: string, t?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await nexusMarket.getPrice(s ?? sym, t ?? tf);
      setPrice(data.price, data.change, data.changePct);
      setCandles(data.candles);
      return data;
    } catch (err: any) {
      setError(err.error ?? err.message ?? 'Price fetch failed');
    } finally {
      setLoading(false);
    }
  }, [sym, tf, setPrice, setCandles]);

  const changeSym = useCallback((s: string) => { setSym(s); fetchPrice(s, tf); }, [setSym, fetchPrice, tf]);
  const changeTf  = useCallback((t: number) => { setTf(t); fetchPrice(sym, t); }, [setTf, fetchPrice, sym]);

  return { sym, tf, price, candles, loading, error, fetchPrice, changeSym, changeTf };
}

// ── useSession ────────────────────────────────────────────────────────
export function useSession() {
  const [session,     setSession]     = useState<any>(null);
  const [badges,      setBadges]      = useState<any[]>([]);
  const [clock,       setClock]       = useState('--:--:--');
  const [dayProgress, setDayProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      const [sess, badgeData, clockData] = await Promise.all([
        nexusSession.current(),
        nexusSession.badges(),
        nexusSession.clock(),
      ]);
      setSession(sess);
      setBadges(badgeData.badges ?? []);
      setClock(clockData.utc);
      setDayProgress(clockData.dayProgress);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 5_000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  return { session, badges, clock, dayProgress };
}

// ── useScanner ────────────────────────────────────────────────────────
export function useScanner() {
  const { results, scanning, lastScan, setResults, setScanning } = useScannerStore();

  const runScan = useCallback(async (syms?: string[], tf = 15) => {
    setScanning(true);
    try {
      const data = await nexusScanner.run(syms, tf);
      setResults(data.results ?? [], data.scannedAt ?? Date.now());
      return data;
    } catch (err: any) {
      setScanning(false);
      throw err;
    }
  }, [setResults, setScanning]);

  return { results, scanning, lastScan, runScan };
}

// ── useRisk ───────────────────────────────────────────────────────────
export function useRisk() {
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const calculate = useCallback(async (params: {
    sym: string; balance: number; riskPct: number;
    entry: number; sl: number; tp?: number;
  }) => {
    if (!params.entry || !params.sl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await nexusRisk.calculate(params);
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.error ?? 'Risk calculation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, calculate };
}

// ── useJournal ────────────────────────────────────────────────────────
export function useJournal() {
  const [entries, setEntries] = useState<any[]>([]);
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, s] = await Promise.all([nexusJournal.list(), nexusJournal.stats()]);
      setEntries(e.entries ?? e ?? []);
      setStats(s.stats ?? s);
    } catch (err: any) {
      setError(err.error ?? 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, []);

  const addEntry = useCallback(async (data: any) => {
    const result = await nexusJournal.add(data);
    await load();
    return result;
  }, [load]);

  const updateEntry = useCallback(async (id: string, updates: any) => {
    const result = await nexusJournal.update(id, updates);
    await load();
    return result;
  }, [load]);

  const deleteEntry = useCallback(async (id: string) => {
    await nexusJournal.remove(id);
    await load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return { entries, stats, loading, error, load, addEntry, updateEntry, deleteEntry };
}

// ── useAlerts ─────────────────────────────────────────────────────────
export function useAlerts() {
  const [alerts,  setAlerts]  = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await nexusAlerts.list();
      setAlerts(data.alerts ?? data ?? []);
    } catch (err: any) {
      setError(err.error ?? 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAlert = useCallback(async (alert: any) => {
    const result = await nexusAlerts.create(alert);
    await load();
    return result;
  }, [load]);

  const deleteAlert = useCallback(async (id: string) => {
    await nexusAlerts.remove(id);
    await load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return { alerts, loading, error, load, createAlert, deleteAlert };
}

// ── usePortfolio ──────────────────────────────────────────────────────
export function usePortfolio() {
  const [summary,   setSummary]   = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history,   setHistory]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async (range = '30d') => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, h] = await Promise.all([
        nexusPortfolio.summary(),
        nexusPortfolio.positions(),
        nexusPortfolio.history(range),
      ]);
      setSummary(s.summary ?? s);
      setPositions(p.positions ?? p ?? []);
      setHistory(h.curve ?? h ?? []);
    } catch (err: any) {
      setError(err.error ?? 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { summary, positions, history, loading, error, load };
}

// ── useAnalytics ──────────────────────────────────────────────────────
export function useAnalytics() {
  const [summary,     setSummary]     = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        nexusAnalytics.summary(),
        nexusAnalytics.performance(),
      ]);
      setSummary(s.stats ?? s);
      setPerformance(p);
    } catch (err: any) {
      setError(err.error ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { summary, performance, loading, error, load };
}
