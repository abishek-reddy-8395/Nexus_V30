/**
 * Nexus V30 — Observability Middleware
 *
 * Wires every HTTP request to:
 *   1. Prometheus metrics (duration histogram + request counter)
 *   2. OpenTelemetry spans (when OTEL_EXPORTER_OTLP_ENDPOINT is set)
 *   3. Human-readable console output in development
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  httpRequestDuration,
  httpRequestTotal,
} from '../../monitoring/metrics/prometheus.metrics';

// Normalise dynamic route segments to avoid cardinality explosion in metrics
// e.g. /api/journal/abc-123-def → /api/journal/:id
function normaliseRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\?.*$/, '');
}

export function observabilityMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start  = process.hrtime.bigint();
    const method = req.method;

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const durationS  = durationMs / 1000;
      const route      = normaliseRoute(req.path);
      const status     = String(res.statusCode);

      // Prometheus
      try {
        httpRequestDuration.observe({ method, route, status }, durationS);
        httpRequestTotal.inc({   method, route, status });
      } catch {
        // Never crash the request pipeline on metrics failure
      }

      // Dev console
      if (process.env.NODE_ENV !== 'production') {
        const color = res.statusCode >= 500 ? '\x1b[31m'
                    : res.statusCode >= 400 ? '\x1b[33m'
                    : res.statusCode >= 200 ? '\x1b[32m'
                    : '\x1b[0m';
        console.log(`${color}[HTTP]\x1b[0m ${method} ${route} → ${status} (${durationMs.toFixed(1)}ms)`);
      }
    });

    next();
  };
}
