/**
 * Nexus V30 — Prometheus Metrics
 *
 * Custom metrics exposed at /metrics (scraped by Prometheus).
 * Covers: HTTP request duration, engine analysis latency,
 * AI request count, WebSocket connections, queue depth.
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'nexus-v30-backend', version: '30.0.0' });

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name:    'nexus_http_request_duration_seconds',
  help:    'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name:    'nexus_http_requests_total',
  help:    'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

// Engine metrics
export const engineAnalysisDuration = new Histogram({
  name:    'nexus_engine_analysis_duration_seconds',
  help:    'SMC engine analysis duration',
  labelNames: ['sym', 'tf', 'mode'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [registry],
});

export const engineAnalysisTotal = new Counter({
  name:    'nexus_engine_analyses_total',
  help:    'Total engine analysis requests',
  labelNames: ['sym', 'tf', 'bias'],
  registers: [registry],
});

// AI metrics
export const aiRequestTotal = new Counter({
  name:    'nexus_ai_requests_total',
  help:    'Total AI API requests',
  labelNames: ['model', 'type', 'status'],
  registers: [registry],
});

export const aiTokensUsed = new Counter({
  name:    'nexus_ai_tokens_total',
  help:    'Total AI tokens consumed',
  labelNames: ['model'],
  registers: [registry],
});

// WebSocket metrics
export const wsConnectionsActive = new Gauge({
  name:    'nexus_ws_connections_active',
  help:    'Active WebSocket connections',
  registers: [registry],
});

// Queue metrics
export const queueDepth = new Gauge({
  name:    'nexus_queue_depth',
  help:    'BullMQ queue depth',
  labelNames: ['queue'],
  registers: [registry],
});

// Market data metrics
export const priceUpdateTotal = new Counter({
  name:    'nexus_price_updates_total',
  help:    'Total price updates fetched',
  labelNames: ['sym', 'source'],
  registers: [registry],
});

// WebSocket metrics
export const wsConnectionsActive = new Gauge({
  name:    'nexus_websocket_connections_active',
  help:    'Current active WebSocket connections',
  labelNames: ['channel'],
  registers: [registry],
});

// Queue metrics
export const queueWaitingJobs = new Gauge({
  name:    'nexus_queue_waiting_jobs',
  help:    'Number of waiting jobs in BullMQ queues',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueActiveJobs = new Gauge({
  name:    'nexus_queue_active_jobs',
  help:    'Number of active jobs in BullMQ queues',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueFailedJobs = new Counter({
  name:    'nexus_queue_failed_jobs_total',
  help:    'Total failed jobs in BullMQ queues',
  labelNames: ['queue'],
  registers: [registry],
});
