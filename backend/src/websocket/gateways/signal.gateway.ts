/**
 * Nexus V30 — Signal Gateway
 * Broadcasts engine signal updates to subscribed WebSocket clients.
 * Listens on SIGNAL_GENERATED Kafka topic (or direct emit in dev).
 *
 * Message sent to client:
 *   { type: 'signal', sym, tf, signal: { bias, conviction, entry, sl, tp1, rr }, ts }
 */
import { WebSocketServer, WebSocket } from 'ws';
import { WsSessionManager } from '../session-manager/session-manager';
import { Logger } from '../../shared/helpers/logger';
import type { WsSignalMessage } from '../../../../packages/shared-types/websocket/index';

const logger = new Logger('SignalGateway');

export class SignalGateway {
  constructor(
    private readonly wss: WebSocketServer,
    private readonly sm:  WsSessionManager,
  ) {}

  start(): void {
    // In production: subscribe to Kafka SIGNAL_GENERATED topic
    // In dev: poll EngineService via scheduler (handled by signal.worker.ts)
    // This gateway is the delivery layer — it receives pre-computed signals
    logger.info('SignalGateway started');
  }

  /** Called by signal.worker.ts after engine produces a signal */
  broadcast(sym: string, tf: number, signal: WsSignalMessage['signal']): void {
    const msg: WsSignalMessage = { type: 'signal', sym, tf, signal, ts: Date.now() };
    const payload = JSON.stringify(msg);
    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}
