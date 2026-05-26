/**
 * Nexus V30 — Scanner Gateway
 * Broadcasts multi-symbol scan results to all connected clients.
 * Triggered by SCAN_COMPLETED Kafka events (or direct from scan worker in dev).
 *
 * Message sent to client:
 *   { type: 'scanner', results: [{sym, bias, conviction, rr}], ts }
 */
import { WebSocketServer, WebSocket } from 'ws';
import { WsSessionManager } from '../session-manager/session-manager';
import { Logger } from '../../shared/helpers/logger';
import type { WsScannerMessage } from '../../../../packages/shared-types/websocket/index';

const logger = new Logger('ScannerGateway');

export class ScannerGateway {
  constructor(
    private readonly wss: WebSocketServer,
    private readonly sm:  WsSessionManager,
  ) {}

  start(): void {
    logger.info('ScannerGateway started');
  }

  /** Broadcast scanner results to all authenticated clients */
  broadcastScan(results: WsScannerMessage['results']): void {
    const msg: WsScannerMessage = { type: 'scanner', results, ts: Date.now() };
    const payload = JSON.stringify(msg);
    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}
