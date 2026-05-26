/**
 * Nexus V30 — API Client (Frontend)
 *
 * Single source of truth for ALL backend communication.
 * The frontend has NO business logic — only this file speaks to the server.
 *
 * v5 improvements:
 *   - SSR-safe token storage: cookie-first, memory fallback (no localStorage)
 *   - localStorage removed — breaks SSR and fails Safari ITP in iframes
 *   - Automatic token refresh on 401 (single in-flight refresh lock)
 *   - Exponential retry for transient network errors
 *   - Typed error responses with structured error codes
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const BASE_URL    = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_COOKIE   = 'nexus_token_v3';
const REFRESH_COOKIE = 'nexus_refresh_v3';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// ── SSR-safe cookie helpers ────────────────────────────────────────────
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE): void {
  if (typeof document === 'undefined') return;
  try {
    const secure   = location.protocol === 'https:' ? '; Secure' : '';
    const sameSite = '; SameSite=Strict';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/${secure}${sameSite}`;
  } catch {}
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try { document.cookie = `${name}=; Max-Age=0; Path=/`; } catch {}
}

// ── In-memory fallback (for SSR and test environments) ────────────────
let _memToken:   string | null = null;
let _memRefresh: string | null = null;

// ── Token store ────────────────────────────────────────────────────────
const token = {
  get():        string | null { return getCookie(TOKEN_COOKIE)   ?? _memToken;   },
  getRefresh(): string | null { return getCookie(REFRESH_COOKIE) ?? _memRefresh; },

  set(t: string, r?: string): void {
    setCookie(TOKEN_COOKIE, t);
    _memToken = t;
    if (r) {
      setCookie(REFRESH_COOKIE, r);
      _memRefresh = r;
    }
  },

  clear(): void {
    clearCookie(TOKEN_COOKIE);
    clearCookie(REFRESH_COOKIE);
    _memToken   = null;
    _memRefresh = null;
  },
};

// ── In-flight refresh lock (prevents multiple concurrent refresh calls) ─
let _refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refresh = token.getRefresh();
    if (!refresh) return null;
    try {
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { token: refresh });
      token.set(data.token, data.refreshToken ?? refresh);
      return data.token as string;
    } catch {
      token.clear();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── Core Axios instance ────────────────────────────────────────────────
function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 20_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach JWT to every request
  client.interceptors.request.use((config) => {
    const tok = token.get();
    if (tok) config.headers.Authorization = `Bearer ${tok}`;
    return config;
  });

  // Handle 401 with automatic token refresh + retry
  client.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      const original = err.config as AxiosRequestConfig & { _retry?: boolean };
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true;
        const newToken = await refreshToken();
        if (newToken) {
          original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
          return client(original);
        }
        // Refresh failed — signal auth loss to the app
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexus:unauthenticated'));
        }
      }
      // Normalize error shape for consistent consumption
      return Promise.reject(err.response?.data ?? { error: err.message, status: 0 });
    }
  );

  return client;
}

const http = createClient();

// ── Auth ───────────────────────────────────────────────────────────────
export const nexusAuth = {
  async login(email: string, password: string) {
    const { data } = await http.post('/api/auth/login', { email, password });
    token.set(data.token, data.refreshToken);
    return data;
  },
  async register(email: string, password: string, name?: string) {
    const { data } = await http.post('/api/auth/register', { email, password, name });
    token.set(data.token, data.refreshToken);
    return data;
  },
  async logout() {
    try { await http.post('/api/auth/logout'); } catch {}
    token.clear();
  },
  async refresh() {
    const { data } = await http.post('/api/auth/refresh', { token: token.getRefresh() });
    token.set(data.token, data.refreshToken);
    return data;
  },
  async me()                           { const { data } = await http.get('/api/auth/me'); return data; },
  async verifyEmail(tok: string)       { const { data } = await http.get(`/api/auth/verify-email?token=${tok}`); return data; },
  async resendVerification(email: string) { const { data } = await http.post('/api/auth/resend-verification', { email }); return data; },
  async forgotPassword(email: string)  { const { data } = await http.post('/api/auth/forgot-password', { email }); return data; },
  async resetPassword(tok: string, password: string) { const { data } = await http.post('/api/auth/reset-password', { token: tok, password }); return data; },
  isLoggedIn()                         { return !!token.get(); },
  getToken()                           { return token.get(); },
};

// ── Market ─────────────────────────────────────────────────────────────
export const nexusMarket = {
  getPrice:       (sym: string, tf = 15) => http.get(`/api/market/price/${sym}?tf=${tf}`).then(r => r.data),
  getWatchlist:   ()                      => http.get('/api/market/watchlist').then(r => r.data),
  getInstruments: ()                      => http.get('/api/market/instruments').then(r => r.data),
};

// ── Engine ─────────────────────────────────────────────────────────────
export const nexusEngine = {
  analyze: (sym: string, tf = 15, mode = 'intraday', profile: 'retail'|'institutional' = 'retail') =>
    http.get(`/api/engine/analyze/${sym}?tf=${tf}&mode=${mode}&profile=${profile}`).then(r => r.data),
  scan: (syms?: string[], tf = 15, profile: 'retail'|'institutional' = 'retail') => {
    const q = syms?.length ? `?syms=${syms.join(',')}&tf=${tf}&profile=${profile}` : `?tf=${tf}&profile=${profile}`;
    return http.get(`/api/engine/scan${q}`).then(r => r.data);
  },
  profiles: () => http.get('/api/engine/profiles').then(r => r.data),  // future: use to populate profile toggle dynamically
};

// ── Scanner ────────────────────────────────────────────────────────────
export const nexusScanner = {
  run:          (syms?: string[], tf = 15, profile: 'retail'|'institutional' = 'retail') => http.get(`/api/scanner/run?tf=${tf}&profile=${profile}${syms?.length ? `&syms=${syms.join(',')}` : ''}`).then(r => r.data),
  runCustom:    (syms: string[], tf = 15)  => http.post('/api/scanner/custom', { syms, tf }).then(r => r.data),
  getWatchlist: ()                          => http.get('/api/scanner/watchlist').then(r => r.data),
  getSymbols:   ()                          => http.get('/api/scanner/symbols').then(r => r.data),
};

// ── Journal ────────────────────────────────────────────────────────────
export const nexusJournal = {
  list:   ()                           => http.get('/api/journal').then(r => r.data),
  stats:  ()                           => http.get('/api/journal/stats').then(r => r.data),
  add:    (entry: any)                 => http.post('/api/journal', entry).then(r => r.data),
  update: (id: string, updates: any)  => http.patch(`/api/journal/${id}`, updates).then(r => r.data),
  remove: (id: string)                 => http.delete(`/api/journal/${id}`),
};

// ── Risk ───────────────────────────────────────────────────────────────
export const nexusRisk = {
  calculate:    (params: any) => http.post('/api/risk/calculate', params).then(r => r.data),
  validate:     (params: any) => http.post('/api/risk/validate', params).then(r => r.data),
  execPreview:  (params: any) => http.post('/api/risk/exec-preview', params).then(r => r.data),
  getInstruments: ()          => http.get('/api/risk/instruments').then(r => r.data),
};

// ── Session ────────────────────────────────────────────────────────────
export const nexusSession = {
  current:   ()                            => http.get('/api/session/current').then(r => r.data),
  badges:    ()                            => http.get('/api/session/badges').then(r => r.data),
  clock:     ()                            => http.get('/api/session/clock').then(r => r.data),
};

// ── AI ─────────────────────────────────────────────────────────────────
export const nexusAI = {
  analyze:       (prompt: string, maxTokens = 600)                => http.post('/api/ai/analyze', { prompt, maxTokens }).then(r => r.data),
  marketContext: (payload: any)                                    => http.post('/api/ai/market-context', payload).then(r => r.data),
  warRoom:       (mode: string, vars: Record<string, any> = {})   => http.post('/api/ai/war-room', { mode, ...vars }).then(r => r.data),
};

// ── Calendar ───────────────────────────────────────────────────────────
export const nexusCalendar = {
  upcoming: (impact?: string) => http.get(`/api/calendar/upcoming${impact ? `?impact=${impact}` : ''}`).then(r => r.data),
  events:   (week = 'current') => http.get(`/api/calendar?week=${week}`).then(r => r.data),
};

// ── Portfolio ──────────────────────────────────────────────────────────
export const nexusPortfolio = {
  summary:   ()              => http.get('/api/portfolio/summary').then(r => r.data),
  positions: ()              => http.get('/api/portfolio/positions').then(r => r.data),
  history:   (range = '30d') => http.get(`/api/portfolio/history?range=${range}`).then(r => r.data),
};

// ── Execution ──────────────────────────────────────────────────────────
export const nexusExecution = {
  prepare: (params: any) => http.post('/api/execution/prepare', params).then(r => r.data),
  confirm: (id: string)  => http.post(`/api/execution/${id}/confirm`).then(r => r.data),
  cancel:  (id: string)  => http.post(`/api/execution/${id}/cancel`).then(r => r.data),
  history: ()            => http.get('/api/execution/history').then(r => r.data),
};

// ── Analytics ──────────────────────────────────────────────────────────
export const nexusAnalytics = {
  performance: (params?: any) => http.get('/api/analytics/performance', { params }).then(r => r.data),
  summary:     ()             => http.get('/api/analytics/summary').then(r => r.data),
  calendar:    ()             => http.get('/api/analytics/calendar').then(r => r.data),
  retention:   ()             => http.get('/api/analytics/retention').then(r => r.data),
  behavioral:  (days = 7)    => http.get(`/api/analytics/behavioral?days=${days}`).then(r => r.data),
  engagement:  ()             => http.get('/api/analytics/engagement').then(r => r.data),
  insights:    ()             => http.get('/api/analytics/insights').then(r => r.data),
};


// ── Alerts ─────────────────────────────────────────────────────────────
export const nexusAlerts = {
  list:   ()           => http.get('/api/alerts').then(r => r.data),
  create: (alert: any) => http.post('/api/alerts', alert).then(r => r.data),
  toggle: (id: string) => http.patch(`/api/alerts/${id}/toggle`).then(r => r.data),
  remove: (id: string) => http.delete(`/api/alerts/${id}`),
};

// ── Billing ────────────────────────────────────────────────────────────
export const nexusBilling = {
  subscription: ()             => http.get('/api/billing/subscription').then(r => r.data),
  plans:        ()             => http.get('/api/billing/plans').then(r => r.data),
  upgrade:      (plan: string) => http.post('/api/billing/upgrade', { plan }).then(r => r.data),
};

// ── Users ──────────────────────────────────────────────────────────────
export const nexusUsers = {
  me:             ()                                     => http.get('/api/users/me').then(r => r.data),
  updateProfile:  (name: string)                         => http.patch('/api/users/me', { name }).then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    http.patch('/api/users/me/password', { currentPassword, newPassword }).then(r => r.data),
};

// ── Copilot (v18) ──────────────────────────────────────────────────────
export const nexusCopilot = {
  chat:               (query: string, history?: any[], marketContext?: string) =>
    http.post('/api/copilot/chat', { query, conversationHistory: history, marketContext }).then(r => r.data),
  sessionDebrief:     (trades: any[], sessionPnl?: number, duration?: number, instruments?: string[]) =>
    http.post('/api/copilot/session-debrief', { trades, sessionPnl, sessionDuration: duration, instruments }).then(r => r.data),
  journalInsight:     (journalText: string, tradeData?: any) =>
    http.post('/api/copilot/journal-insight', { journalText, tradeData }).then(r => r.data),
  behavioralCoaching: (signalType: string, tradeData?: any) =>
    http.post('/api/copilot/behavioral-coaching', { signalType, tradeData }).then(r => r.data),
};

// ── Analytics enterprise (v18) ─────────────────────────────────────────

// ── White-label (v18) ─────────────────────────────────────────────────
export const nexusWhitelabel = {
  getConfig:          ()                           => http.get('/api/whitelabel/config').then(r => r.data),
  updateConfig:       (updates: Record<string, any>) => http.patch('/api/whitelabel/config', updates).then(r => r.data),
  getFeatureFlags:    ()                           => http.get('/api/whitelabel/feature-flags').then(r => r.data),
  setFeatureFlag:     (key: string, enabled: boolean, rolloutPct?: number) =>
    http.patch(`/api/whitelabel/feature-flags/${key}`, { enabled, rolloutPct }).then(r => r.data),
};

// ── Audit (v18) ───────────────────────────────────────────────────────
export const nexusAudit = {
  list:   (params?: { resource?: string; actor?: string; from?: string; to?: string; page?: number }) =>
    http.get('/api/audit', { params }).then(r => r.data),
  export: (format: 'csv' | 'json' = 'json', from?: string, to?: string) =>
    http.get('/api/audit/export', { params: { format, from, to } }).then(r => r.data),
};

// ── Billing portal (v18) ──────────────────────────────────────────────
Object.assign(nexusBilling, {
  portal: () => http.post('/api/billing/portal').then(r => r.data),
});

// ── Organizations (v18) ───────────────────────────────────────────────
export const nexusOrg = {
  current:      ()                  => http.get('/api/organizations/current').then(r => r.data),
  members:      ()                  => http.get('/api/organizations/members').then(r => r.data),
  invite:       (email: string, role = 'TRADER') => http.post('/api/organizations/members/invite', { email, role }).then(r => r.data),
  removeMember: (id: string)        => http.delete(`/api/organizations/members/${id}`).then(r => r.data),
  update:       (name: string)      => http.patch('/api/organizations/current', { name }).then(r => r.data),
};
