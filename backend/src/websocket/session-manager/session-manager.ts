/**
 * Nexus V30 — WebSocket Session Manager
 *
 * Tracks authenticated WebSocket connections per user and tenant.
 * Used by all gateways to route targeted messages (e.g. personal alerts)
 * and to enforce per-tenant connection limits.
 */

import { WebSocket } from 'ws';

export interface WsSession {
  ws:       WebSocket;
  userId:   string;
  tenantId: string;
  subs:     Set<string>; // active subscription topics
  authed:   boolean;
  connectedAt: Date;
}

export class WsSessionManager {
  private readonly sessions = new Map<WebSocket, WsSession>();

  register(ws: WebSocket, userId: string, tenantId: string): WsSession {
    const session: WsSession = {
      ws, userId, tenantId,
      subs:        new Set(),
      authed:      true,
      connectedAt: new Date(),
    };
    this.sessions.set(ws, session);
    return session;
  }

  get(ws: WebSocket): WsSession | undefined {
    return this.sessions.get(ws);
  }

  remove(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  /** Broadcast to all authenticated connections */
  broadcast(data: unknown): void {
    const msg = JSON.stringify(data);
    for (const { ws, authed } of this.sessions.values()) {
      if (authed && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  /** Send to all connections for a specific tenant */
  broadcastToTenant(tenantId: string, data: unknown): void {
    const msg = JSON.stringify(data);
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(msg);
      }
    }
  }

  /** Send to a specific user */
  sendToUser(userId: string, data: unknown): void {
    const msg = JSON.stringify(data);
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(msg);
      }
    }
  }

  get size(): number { return this.sessions.size; }
}
