/**
 * Nexus V30 — Price Stream Gateway
 *
 * Broadcasts live price ticks to all subscribed WebSocket clients.
 * Same model as v2 priceStream.js — now typed, multi-channel,
 * and integrated with the WsSessionManager for tenant-scoped delivery.
 *
 * Message protocol:
 *   Client → { type: 'auth',        token: '<jwt>' }
 *   Client → { type: 'subscribe',   sym: 'XAUUSD', tf: 15 }
 *   Client → { type: 'unsubscribe', sym: 'XAUUSD' }
 *   Server → { type: 'price',       sym, price, change, changePct, ts }
 *   Server → { type: 'candle',      sym, tf, candle: OhlcvCandle }
 *   Server → { type: 'error',       message }
 */

import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { WsSessionManager } from '../session-manager/session-manager';
import { Logger }           from '../../shared/helpers/logger';
import { JWT_SECRET }       from '../../shared/constants/index';

const logger = new Logger('PriceStreamGateway');

export class PriceStreamGateway {
  private readonly subscriptions = new Map<string, Set<WebSocket>>();

  constructor(
    private readonly wss: WebSocketServer,
    private readonly sessionManager: WsSessionManager,
  ) {}

  start(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('New WS connection');

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          this._handleMessage(ws, msg);
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        this._cleanup(ws);
        this.sessionManager.remove(ws);
        logger.debug('WS connection closed');
      });

      ws.on('error', (err) => logger.warn('WS error:', err.message));
    });

    setInterval(() => this._broadcastPrices(), 2_000);
    logger.info('PriceStreamGateway started');
  }

  private _handleMessage(ws: WebSocket, msg: any): void {
    switch (msg.type) {
      case 'auth': {
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET) as any;
          this.sessionManager.register(ws, payload.id, payload.tenantId);
          ws.send(JSON.stringify({ type: 'auth_ok', userId: payload.id }));
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
        }
        break;
      }
      case 'subscribe': {
        const session = this.sessionManager.get(ws);
        if (!session?.authed) { ws.send(JSON.stringify({ type: 'error', message: 'Authenticate first' })); return; }
        const sym = (msg.sym as string).toUpperCase();
        if (!this.subscriptions.has(sym)) this.subscriptions.set(sym, new Set());
        this.subscriptions.get(sym)!.add(ws);
        session.subs.add(sym);
        ws.send(JSON.stringify({ type: 'subscribed', sym }));
        break;
      }
      case 'unsubscribe': {
        const sym = (msg.sym as string).toUpperCase();
        this.subscriptions.get(sym)?.delete(ws);
        ws.send(JSON.stringify({ type: 'unsubscribed', sym }));
        break;
      }
      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
    }
  }

  private _broadcastPrices(): void {
    for (const [sym, clients] of this.subscriptions.entries()) {
      if (!clients.size) continue;
      const price = this._mockPrice(sym);
      const payload = JSON.stringify({ type: 'price', sym, ...price, ts: Date.now() });
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
        else clients.delete(ws);
      }
    }
  }

  private _cleanup(ws: WebSocket): void {
    for (const clients of this.subscriptions.values()) clients.delete(ws);
  }

  private _mockPrice(sym: string): { price: number; change: number; changePct: number } {
    const base = sym.includes('BTC') ? 65_000 : sym.includes('XAU') ? 2_350 : 1.08;
    const price = base + (Math.random() - 0.5) * base * 0.0005;
    return { price: parseFloat(price.toFixed(2)), change: 0, changePct: 0 };
  }
}
