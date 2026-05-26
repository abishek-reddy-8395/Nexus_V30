/**
 * Nexus V30 — WebSocket Client (Frontend)
 *
 * Multi-channel (prices, signals, scanner, alerts) WebSocket client.
 * v5 fixes:
 *   - No localStorage (breaks SSR + Safari ITP) — token read from cookie or memory
 *   - Exponential backoff with jitter (prevents thundering herd on reconnect)
 *   - Heartbeat ping/pong to detect silent disconnections
 *   - Connection state exposed for UI indicators
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

const TOKEN_COOKIE = 'nexus_token_v3';
const PING_INTERVAL_MS  = 25_000; // send ping every 25s
const PONG_TIMEOUT_MS   = 5_000;  // if no pong in 5s, reconnect
const MAX_RECONNECT_MS  = 30_000;
const BASE_RECONNECT_MS = 1_000;

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected';

export type WsMessage =
  | { type: 'price';      sym: string; price: number; change: number; changePct: number; ts: number }
  | { type: 'candle';     sym: string; tf: number; candle: any }
  | { type: 'signal';     sym: string; signal: any }
  | { type: 'scanner';    results: any[] }
  | { type: 'alert';      alert: any }
  | { type: 'auth_ok';    userId: string }
  | { type: 'subscribed'; sym: string }
  | { type: 'pong' }
  | { type: 'error';      message: string };

type MessageHandler    = (msg: WsMessage) => void;
type StateHandler      = (state: WsConnectionState) => void;

function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Jitter: spread reconnects so clients don't pile in simultaneously
function backoffDelay(attempt: number): number {
  const base = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** attempt);
  return base * (0.5 + Math.random() * 0.5);
}

export class NexusWebSocket {
  private ws:               WebSocket | null = null;
  private reconnectTimer:   ReturnType<typeof setTimeout> | null = null;
  private pingTimer:        ReturnType<typeof setInterval> | null = null;
  private pongTimer:        ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private handlers:         Set<MessageHandler>  = new Set();
  private stateHandlers:    Set<StateHandler>    = new Set();
  private pendingSubs:      Array<{ sym: string; tf: number }> = [];
  private _state:           WsConnectionState = 'disconnected';
  // In-memory token fallback (set after login)
  private _token: string | null = null;

  /** Set auth token from in-memory (call after login if cookie not used) */
  setToken(token: string) { this._token = token; }

  get state(): WsConnectionState { return this._state; }

  connect(): this {
    this._open();
    return this;
  }

  private _setState(s: WsConnectionState) {
    this._state = s;
    this.stateHandlers.forEach(h => h(s));
  }

  private _open(): void {
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this._setState('connecting');
    this._clearPing();

    const tok = this._token ?? getTokenFromCookie();
    this.ws   = new WebSocket(`${WS_URL}/ws`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._setState('connected');
      if (tok) this._send({ type: 'auth', token: tok });
      for (const sub of this.pendingSubs) {
        this._send({ type: 'subscribe', ...sub });
      }
      this._startPing();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        if (msg.type === 'pong') {
          // Pong received — cancel the timeout
          if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
          return;
        }
        for (const handler of this.handlers) handler(msg);
      } catch {}
    };

    this.ws.onerror = () => {};
    this.ws.onclose = () => {
      this._setState('disconnected');
      this._clearPing();
      this._scheduleReconnect();
    };
  }

  private _startPing() {
    this.pingTimer = setInterval(() => {
      this._send({ type: 'ping' });
      this.pongTimer = setTimeout(() => {
        // No pong — connection is dead; force reconnect
        if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
        this._setState('disconnected');
        this._scheduleReconnect();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private _clearPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.pongTimer) { clearTimeout(this.pongTimer);  this.pongTimer = null; }
  }

  subscribe(sym: string, tf: number): void {
    const sub = { sym: sym.toUpperCase(), tf };
    if (!this.pendingSubs.some(s => s.sym === sub.sym && s.tf === tf)) {
      this.pendingSubs.push(sub);
    }
    if (this._state === 'connected') this._send({ type: 'subscribe', ...sub });
  }

  unsubscribe(sym: string): void {
    this.pendingSubs = this.pendingSubs.filter(s => s.sym !== sym.toUpperCase());
    if (this._state === 'connected') this._send({ type: 'unsubscribe', sym: sym.toUpperCase() });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  close(): void {
    this._clearPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this._setState('disconnected');
  }

  private _send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return; // already scheduled
    const delay = backoffDelay(this.reconnectAttempts++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._open();
    }, delay);
  }
}

// Singleton — null on the server (SSR safe)
export const nexusWS = typeof window !== 'undefined' ? new NexusWebSocket() : null;
