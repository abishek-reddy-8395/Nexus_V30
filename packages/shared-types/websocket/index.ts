/**
 * @nexus-v30/shared-types — WebSocket Message Contracts
 *
 * Every message that crosses the WebSocket boundary has a type here.
 * Both server (gateways) and client (nexus-ws.client.ts) import from this file.
 * This is the single source of truth for the WS protocol.
 */

// ── Client → Server ───────────────────────────────────────────────────
export interface WsAuthMessage {
  type:  'auth';
  token: string;
}

export interface WsSubscribeMessage {
  type: 'subscribe';
  sym:  string;
  tf:   number;
}

export interface WsUnsubscribeMessage {
  type: 'unsubscribe';
  sym:  string;
}

export type WsClientMessage =
  | WsAuthMessage
  | WsSubscribeMessage
  | WsUnsubscribeMessage;

// ── Server → Client ───────────────────────────────────────────────────
export interface WsAuthOkMessage {
  type:   'auth_ok';
  userId: string;
}

export interface WsAuthErrorMessage {
  type:    'auth_error';
  message: string;
}

export interface WsSubscribedMessage {
  type: 'subscribed';
  sym:  string;
}

export interface WsPriceMessage {
  type:      'price';
  sym:       string;
  price:     number;
  change:    number;
  changePct: number;
  ts:        number;
}

export interface WsCandleMessage {
  type:   'candle';
  sym:    string;
  tf:     number;
  candle: {
    time:   number;
    open:   number;
    high:   number;
    low:    number;
    close:  number;
    volume: number;
  };
}

export interface WsSignalMessage {
  type:   'signal';
  sym:    string;
  tf:     number;
  signal: {
    bias:       'BULL' | 'BEAR' | 'NEUTRAL' | 'WAIT';
    conviction: number;
    entry:      number | null;
    sl:         number | null;
    tp1:        number | null;
    rr:         string | null;
  };
  ts: number;
}

export interface WsScannerMessage {
  type:    'scanner';
  results: Array<{
    sym:        string;
    bias:       string;
    conviction: number;
    rr:         string | null;
  }>;
  ts: number;
}

export interface WsAlertMessage {
  type:  'alert';
  alert: {
    id:          string;
    sym:         string;
    alertType:   string;
    title:       string;
    description: string;
    ts:          number;
  };
}

export interface WsErrorMessage {
  type:    'error';
  message: string;
}

export type WsServerMessage =
  | WsAuthOkMessage
  | WsAuthErrorMessage
  | WsSubscribedMessage
  | WsPriceMessage
  | WsCandleMessage
  | WsSignalMessage
  | WsScannerMessage
  | WsAlertMessage
  | WsErrorMessage;
