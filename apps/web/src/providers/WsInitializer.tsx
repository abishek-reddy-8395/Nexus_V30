'use client';
/**
 * Nexus — WebSocket Initializer (fixed)
 *
 * FIX: Removed `if (!user) return` gate.
 * The WS client reads the token from the cookie itself on connect.
 * Gating on user meant WS never started during the async auth-check window,
 * causing the dashboard to permanently show "offline".
 *
 * The WS authenticates itself via { type: 'auth', token } on open.
 * If no token exists yet, it connects anonymously and re-auths after login.
 */
import { useEffect } from 'react';
import { initWsStore } from '../state/ws-store';
import { nexusWS } from '../websocket/nexus-ws.client';

export function WsInitializer() {
  useEffect(() => {
    // Connect immediately — WS reads token from cookie internally
    initWsStore();
    nexusWS?.subscribe('XAUUSD', 15);
    nexusWS?.subscribe('EURUSD', 15);
    nexusWS?.subscribe('BTCUSD', 15);
  }, []); // Empty dep array — runs once on mount, unconditionally

  return null;
}
