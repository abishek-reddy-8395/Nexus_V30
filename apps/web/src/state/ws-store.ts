/**
 * Nexus V30 — WebSocket State Store (Zustand)
 *
 * Bridges the NexusWebSocket singleton to reactive Zustand state.
 * Components subscribe to this store — they never touch the WS directly.
 *
 * Initialise once in layout.tsx with initWsStore().
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { nexusWS } from '../websocket/nexus-ws.client';
import { useMarketStore } from './store';

interface WsState {
  connected:      boolean;
  lastSignal:     any | null;
  lastAlert:      any | null;
  scannerResults: any[];
  priceMap:       Record<string, { price: number; change: number; changePct: number; ts: number }>;

  setConnected:      (v: boolean) => void;
  setLastSignal:     (s: any) => void;
  setLastAlert:      (a: any) => void;
  setScannerResults: (r: any[]) => void;
  updatePrice:       (sym: string, data: { price: number; change: number; changePct: number; ts: number }) => void;
}

export const useWsStore = create<WsState>()(
  devtools(
    (set) => ({
      connected:      false,
      lastSignal:     null,
      lastAlert:      null,
      scannerResults: [],
      priceMap:       {},

      setConnected:      (connected)      => set({ connected }),
      setLastSignal:     (lastSignal)     => set({ lastSignal }),
      setLastAlert:      (lastAlert)      => set({ lastAlert }),
      setScannerResults: (scannerResults) => set({ scannerResults }),
      updatePrice:       (sym, data)      => set((s) => ({ priceMap: { ...s.priceMap, [sym]: data } })),
    }),
    { name: 'NexusWS' },
  ),
);

let _initialized = false;

/** Call once at app root. Connects WS and wires messages to store. */
export function initWsStore(): void {
  // Reset flag if WS is not connected (e.g. after logout/reconnect)
  if (_initialized && nexusWS?.state !== 'disconnected') return;
  _initialized = true;

  nexusWS.connect();

  const { setLastSignal, setLastAlert, setScannerResults, updatePrice } = useWsStore.getState();
  const { setPrice } = useMarketStore.getState();

  nexusWS.onMessage((msg) => {
    switch (msg.type) {
      case 'price':
        updatePrice(msg.sym, { price: msg.price, change: msg.change, changePct: msg.changePct, ts: msg.ts });
        // If this is the currently viewed symbol, also update the market store
        if (useMarketStore.getState().sym === msg.sym) {
          setPrice(msg.price, msg.change, msg.changePct);
        }
        break;
      case 'signal':
        setLastSignal({ sym: msg.sym, ...msg.signal, ts: Date.now() });
        break;
      case 'alert':
        setLastAlert(msg.alert);
        break;
      case 'scanner':
        setScannerResults(msg.results ?? []);
        break;
    }
  });
}
