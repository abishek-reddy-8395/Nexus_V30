/**
 * Nexus V30 — OpenTelemetry Tracing
 *
 * Initialises OTLP trace exporter (Jaeger / Grafana Tempo / etc).
 * Call initTracing() before any other imports in main.ts.
 *
 * Install when ready:
 *   pnpm add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http
 *   @opentelemetry/auto-instrumentations-node
 */

import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('OTEL');

export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    logger.debug('OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled');
    return;
  }

  // Dynamic import to avoid crashing when SDK packages are not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK }                  = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter }        = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

    const sdk = new NodeSDK({
      serviceName:     'nexus-v30-backend',
      traceExporter:   new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
      })],
    });

    sdk.start();
    logger.info(`OpenTelemetry tracing → ${endpoint}`);

    process.on('SIGTERM', () => sdk.shutdown());
    process.on('SIGINT',  () => sdk.shutdown());
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn('OpenTelemetry SDK not installed. Run: pnpm add @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-node');
    } else {
      logger.error(`OpenTelemetry init failed: ${err.message}`);
    }
  }
}
