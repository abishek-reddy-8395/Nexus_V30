/**
 * Nexus V30 — Alert Gateway
 * Delivers triggered alerts to the specific user who created them.
 * Receives events from the alert.consumer.ts Kafka bridge.
 *
 * Message sent to client:
 *   { type: 'alert', alert: { id, sym, alertType, title, description, ts } }
 */
import { WebSocketServer, WebSocket } from 'ws';
import { WsSessionManager } from '../session-manager/session-manager';
import { Logger } from '../../shared/helpers/logger';
import type { AlertTriggeredEvent } from '../../events/consumers/alert.consumer';
import type { WsAlertMessage } from '../../../../packages/shared-types/websocket/index';

const logger = new Logger('AlertGateway');

export class AlertGateway {
  constructor(
    private readonly wss: WebSocketServer,
    private readonly sm:  WsSessionManager,
  ) {}

  start(): void {
    logger.info('AlertGateway started');
  }

  /** Called by alert.consumer.ts when a Kafka alert event is received */
  broadcast(event: AlertTriggeredEvent): void {
    const msg: WsAlertMessage = {
      type: 'alert',
      alert: {
        id:        event.id,
        sym:       event.sym,
        alertType: event.type as any,
        title:     `Alert triggered: ${event.sym}`,
        description: event.message,
        ts:        event.triggeredAt,
      },
    };
    // Deliver only to the specific user who created the alert
    this.sm.sendToUser(event.userId, msg);
    logger.debug(`Alert delivered to user ${event.userId}: ${event.sym}`);
  }

  /** Direct delivery (used by routes for immediate notification) */
  sendToUser(userId: string, alert: WsAlertMessage['alert']): void {
    const msg: WsAlertMessage = { type: 'alert', alert };
    this.sm.sendToUser(userId, msg);
  }
}
