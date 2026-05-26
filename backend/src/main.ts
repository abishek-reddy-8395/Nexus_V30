/**
 * Nexus V30 — Backend Entry Point
 *
 * Architecture: All business logic, SMC engine computations, and AI inference
 * run exclusively here. The frontend is a pure visual/render layer.
 */

// OTel MUST be initialised before any other imports so auto-instrumentation patches Node internals
import { initTracing } from './monitoring/tracing/otel';
initTracing();

import 'dotenv/config';
import { createApp }      from './bootstrap/app.bootstrap';
import { startServer }    from './bootstrap/server.bootstrap';
import { startWebSocket } from './bootstrap/websocket.bootstrap';
import { startSignalWorker }                        from './workers/signals/signal.worker';
import { startAlertWorker }                         from './workers/alerts/alert.worker';
import { startCandleWorker, scheduleCandleRefresh } from './workers/candles/candle.worker';
import { Logger } from './shared/helpers/logger';

const logger = new Logger('Main');

async function bootstrap(): Promise<void> {
  try {
    const app    = await createApp();
    const server = await startServer(app);
    await startWebSocket(server);

    // ── Background workers ─────────────────────────────────────────
    try {
      startCandleWorker();
      startSignalWorker();
      startAlertWorker();
      await scheduleCandleRefresh();
      logger.info('Background workers started (candle, signal, alert)');
    } catch (workerErr: any) {
      // Workers are non-critical — Redis/Kafka may not be available in dev
      logger.warn(`Workers failed to start (Redis/Kafka unavailable?): ${workerErr.message}`);
    }

    const port = process.env.PORT ?? 3001;
    logger.info(`Nexus V30 backend running on port ${port}`);
    logger.info(`Health: http://localhost:${port}/health`);
    logger.info(`WS:     ws://localhost:${port}/ws`);
  } catch (error) {
    logger.error('Fatal startup error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => { logger.info('SIGTERM — shutting down'); process.exit(0); });
process.on('SIGINT',  () => { logger.info('SIGINT  — shutting down'); process.exit(0); });

bootstrap();
