/**
 * Nexus V30 — WebSocket Bootstrap
 *
 * Channels (all require JWT on first message):
 *   /ws  — multiplexed: prices, signals, scanner, alerts
 *
 * Critical wiring: Kafka consumers → WS gateways.
 * Signal consumer receives engine events and broadcasts to WS clients.
 * Alert consumer receives triggered alerts and broadcasts notifications.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { PriceStreamGateway }  from '../websocket/gateways/price-stream.gateway';
import { SignalGateway }       from '../websocket/gateways/signal.gateway';
import { ScannerGateway }      from '../websocket/gateways/scanner.gateway';
import { AlertGateway }        from '../websocket/gateways/alert.gateway';
import { WsSessionManager }    from '../websocket/session-manager/session-manager';
import { startSignalConsumer } from '../events/consumers/signal.consumer';
import { startAlertConsumer }  from '../events/consumers/alert.consumer';
import { Logger }              from '../shared/helpers/logger';

const logger = new Logger('WsBootstrap');

export async function startWebSocket(server: http.Server): Promise<void> {
  const wss            = new WebSocketServer({ server, path: '/ws' });
  const sessionManager = new WsSessionManager();

  const priceGateway   = new PriceStreamGateway(wss, sessionManager);
  const signalGateway  = new SignalGateway(wss, sessionManager);
  const scannerGateway = new ScannerGateway(wss, sessionManager);
  const alertGateway   = new AlertGateway(wss, sessionManager);

  priceGateway.start();
  signalGateway.start();
  scannerGateway.start();
  alertGateway.start();

  // ── Wire Kafka consumers → WebSocket gateways ──────────────────────
  // Signal consumer: broadcasts engine signals to subscribed WS clients
  await startSignalConsumer(async (event) => {
    signalGateway.broadcast(event.sym, event.tf, event.signal);
  }).catch((err) => logger.warn(`Signal consumer not started: ${err.message}`));

  // Alert consumer: broadcasts triggered alerts to WS clients
  await startAlertConsumer(async (event) => {
    alertGateway.broadcast(event);
  }).catch((err) => logger.warn(`Alert consumer not started: ${err.message}`));

  logger.info('WebSocket server started — price/signal/scanner/alert gateways live');
}
