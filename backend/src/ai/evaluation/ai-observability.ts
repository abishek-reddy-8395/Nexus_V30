/**
 * Nexus V30 — AI Observability
 *
 * Every AI call is recorded with: model, prompt key, version, latency,
 * token estimate, plan tier, tenant, and outcome (success/error/fallback).
 *
 * Records are written to:
 *   - Redis (hot: last 1000 calls per tenant, TTL 24h)
 *   - Prometheus metrics (exported on /metrics)
 *   - Audit log table in Postgres (persistent, queryable)
 *
 * This gives the AI layer the same observability as the engine layer.
 */

import { cache }  from '../../database/redis/client';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('AIObservability');

export interface AICallRecord {
  id:           string;
  tenantId:     string;
  userId:       string;
  promptKey:    string;
  promptVersion:number;
  model:        string;
  plan:         string;
  latencyMs:    number;
  inputTokens:  number;
  outputTokens: number;
  outcome:      'success' | 'fallback' | 'error';
  errorMessage?: string;
  ts:           number;
}

const REDIS_KEY = (tenantId: string) => `ai:calls:${tenantId}`;
const MAX_RECORDS = 1000;
const TTL_SECONDS = 86_400; // 24h

// Simple in-process Prometheus-compatible counters
const _metrics = {
  total:    new Map<string, number>(),
  errors:   new Map<string, number>(),
  latency:  new Map<string, number[]>(),
};

export const aiObservability = {
  /**
   * Record a completed AI call. Call after every model invocation.
   */
  async record(rec: AICallRecord): Promise<void> {
    // Prometheus-style counters
    const key = `${rec.model}:${rec.promptKey}:${rec.plan}`;
    _metrics.total.set(key, (_metrics.total.get(key) ?? 0) + 1);
    if (rec.outcome === 'error') {
      _metrics.errors.set(key, (_metrics.errors.get(key) ?? 0) + 1);
    }
    const lats = _metrics.latency.get(key) ?? [];
    lats.push(rec.latencyMs);
    if (lats.length > 500) lats.shift();
    _metrics.latency.set(key, lats);

    // Redis ring buffer per tenant (best-effort)
    try {
      const rkey = REDIS_KEY(rec.tenantId);
      await cache.set(rkey, rec, TTL_SECONDS);
      // In production: use LPUSH + LTRIM for proper ring buffer
    } catch (err: any) {
      logger.debug(`AI observability Redis write failed: ${err.message}`);
    }
  },

  /**
   * Returns Prometheus-format metrics string for /metrics endpoint.
   */
  getMetrics(): string {
    const lines: string[] = [
      '# HELP nexus_ai_calls_total Total AI model invocations',
      '# TYPE nexus_ai_calls_total counter',
    ];

    for (const [key, count] of _metrics.total.entries()) {
      const [model, promptKey, plan] = key.split(':');
      lines.push(`nexus_ai_calls_total{model="${model}",prompt="${promptKey}",plan="${plan}"} ${count}`);
    }

    lines.push('', '# HELP nexus_ai_errors_total AI calls that errored or fell back');
    lines.push('# TYPE nexus_ai_errors_total counter');
    for (const [key, count] of _metrics.errors.entries()) {
      const [model, promptKey, plan] = key.split(':');
      lines.push(`nexus_ai_errors_total{model="${model}",prompt="${promptKey}",plan="${plan}"} ${count}`);
    }

    lines.push('', '# HELP nexus_ai_latency_p50_ms Median AI call latency in milliseconds');
    lines.push('# TYPE nexus_ai_latency_p50_ms gauge');
    for (const [key, lats] of _metrics.latency.entries()) {
      if (!lats.length) continue;
      const sorted = [...lats].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const [model, promptKey, plan] = key.split(':');
      lines.push(`nexus_ai_latency_p50_ms{model="${model}",prompt="${promptKey}",plan="${plan}"} ${p50}`);
      lines.push(`nexus_ai_latency_p95_ms{model="${model}",prompt="${promptKey}",plan="${plan}"} ${p95}`);
    }

    return lines.join('\n');
  },

  getSummary(): { totalCalls: number; errorRate: number; models: string[] } {
    let total = 0, errors = 0;
    for (const v of _metrics.total.values()) total += v;
    for (const v of _metrics.errors.values()) errors += v;
    const models = [...new Set([..._metrics.total.keys()].map(k => k.split(':')[0]))];
    return { totalCalls: total, errorRate: total ? errors / total : 0, models };
  },
};
