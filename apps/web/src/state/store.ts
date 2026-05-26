/**
 * Nexus V30 — Global State Store (Zustand)
 *
 * Frontend state management. Stores only UI state and cached API responses —
 * never business logic. All data originates from the backend.
 *
 * v5: Auth store no longer persists token to localStorage (token lives in
 * HttpOnly-style cookie via api.client.ts). UI preferences persist via
 * sessionStorage (same-tab only) to avoid ITP issues.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { EngineAnalysisResult, OhlcvCandle } from '../../../../packages/shared-types/index';

// ── SSR-safe sessionStorage wrapper ───────────────────────────────────
const safeSessionStorage = {
  getItem:    (key: string) => { try { return sessionStorage.getItem(key); }    catch { return null; } },
  setItem:    (key: string, v: string) => { try { sessionStorage.setItem(key, v); }    catch {} },
  removeItem: (key: string) => { try { sessionStorage.removeItem(key); } catch {} },
};

// ── Market state ──────────────────────────────────────────────────────
interface MarketState {
  sym:       string;
  tf:        number;
  price:     number | null;
  change:    number | null;
  changePct: number | null;
  candles:   OhlcvCandle[];
  setSym:    (sym: string) => void;
  setTf:     (tf: number) => void;
  setPrice:  (price: number, change: number, changePct: number) => void;
  setCandles:(candles: OhlcvCandle[]) => void;
}

export const useMarketStore = create<MarketState>()(
  devtools(
    (set) => ({
      sym:       'XAUUSD',
      tf:        15,
      price:     null,
      change:    null,
      changePct: null,
      candles:   [],
      setSym:    (sym)                     => set({ sym }),
      setTf:     (tf)                      => set({ tf }),
      setPrice:  (price, change, changePct)=> set({ price, change, changePct }),
      setCandles:(candles)                  => set({ candles }),
    }),
    { name: 'NexusMarket' }
  )
);

// ── Engine / signal state ─────────────────────────────────────────────
interface EngineState {
  analysis:    EngineAnalysisResult | null;
  loading:     boolean;
  error:       string | null;
  setAnalysis: (analysis: EngineAnalysisResult) => void;
  setLoading:  (loading: boolean) => void;
  setError:    (error: string | null) => void;
  clear:       () => void;
}

export const useEngineStore = create<EngineState>()(
  devtools(
    (set) => ({
      analysis: null,
      loading:  false,
      error:    null,
      setAnalysis: (analysis) => set({ analysis, loading: false, error: null }),
      setLoading:  (loading)  => set({ loading }),
      setError:    (error)    => set({ error, loading: false }),
      clear:       ()         => set({ analysis: null, loading: false, error: null }),
    }),
    { name: 'NexusEngine' }
  )
);

// ── Auth state — NOT persisted (token lives in cookie via api.client) ──
interface AuthState {
  user:      { id: string; email: string; name: string; plan: string; role: string; tenantId: string; emailVerified: boolean } | null;
  setUser:   (user: AuthState['user']) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user:      null,
      setUser:   (user) => set({ user }),
      clearAuth: ()     => set({ user: null }),
    }),
    { name: 'NexusAuth' }
  )
);

// ── UI state — persisted in sessionStorage (same-tab, ITP-safe) ───────
interface UIState {
  activePage:    string;
  sidebarOpen:   boolean;
  mode:          'scalp' | 'intraday' | 'positional';
  overlays:      Record<string, boolean>;
  setActivePage: (page: string) => void;
  setSidebarOpen:(open: boolean) => void;
  setMode:       (mode: UIState['mode']) => void;
  toggleOverlay: (key: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        activePage:    'dashboard',
        sidebarOpen:   true,
        mode:          'intraday',
        overlays:      { sr: true, ob: true, fvg: true, liq: true, vwap: false, choch: false, sessions: true },
        setActivePage: (activePage)  => set({ activePage }),
        setSidebarOpen:(sidebarOpen) => set({ sidebarOpen }),
        setMode:       (mode)        => set({ mode }),
        toggleOverlay: (key)         => set({ overlays: { ...get().overlays, [key]: !get().overlays[key] } }),
      }),
      {
        name:    'nexus-ui-v5',
        storage: createJSONStorage(() => safeSessionStorage),
      }
    ),
    { name: 'NexusUI' }
  )
);

// ── Scanner state ─────────────────────────────────────────────────────
interface ScannerState {
  results:    any[];
  scanning:   boolean;
  lastScan:   number | null;
  setResults: (results: any[], ts: number) => void;
  setScanning:(scanning: boolean) => void;
}

export const useScannerStore = create<ScannerState>()(
  devtools(
    (set) => ({
      results:    [],
      scanning:   false,
      lastScan:   null,
      setResults: (results, lastScan) => set({ results, lastScan, scanning: false }),
      setScanning:(scanning)          => set({ scanning }),
    }),
    { name: 'NexusScanner' }
  )
);
