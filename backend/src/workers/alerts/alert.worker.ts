/**
 * Nexus V30 — Alert Evaluation Worker
 *
 * Evaluates user-defined alert conditions against incoming price/signal data.
 * Consumed by: SIGNAL_GENERATED and CANDLE_UPDATED Kafka topics.
 * Emits: ALERT_TRIGGERED → notification service.
 *
 * Alert types:
 *   price      — price crosses a level
 *   signal     — engine bias changes to BULL/BEAR
 *   confluence — confluence score exceeds threshold
 */

import { Worker, Job }  from 'bullmq';
import { QUEUE_NAMES }  from '../../queues/bullmq/queues';
import { emit }         from '../../events/producers/event.producer';
import { TOPICS }       from '../../events/topics/index';
import { Logger }       from '../../shared/helpers/logger';

const logger = new Logger('AlertWorker');

export interface AlertCondition {
  type:       'price' | 'signal' | 'confluence';
  sym:        string;
  operator?:  'above' | 'below' | 'crosses';
  value?:     number;
  bias?:      'BULL' | 'BEAR';
  minScore?:  number;
}

export interface AlertJob {
  alertId:   string;
  userId:    string;
  tenantId:  string;
  condition: AlertCondition;
  currentPrice: number;
  currentSignal?: { bias: string; conviction: number };
}

export function startAlertWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.ALERT_EVAL,
    async (job: Job<AlertJob>) => {
      const { alertId, userId, tenantId, condition, currentPrice, currentSignal } = job.data;

      const triggered = evalCondition(condition, currentPrice, currentSignal);
      if (!triggered) return;

      logger.info(`Alert triggered: ${alertId} for user ${userId} (${condition.type} on ${condition.sym})`);

      await emit(TOPICS.ALERT_TRIGGERED, {
        alertId,
        userId,
        tenantId,
        condition,
        triggeredAt: Date.now(),
        currentPrice,
      }, userId);

      // Mark alert as triggered in DB
      try {
        const { query } = await import('../../database/postgres/client');
        await query(
          'UPDATE alerts SET triggered=true, triggered_at=NOW() WHERE id=$1',
          [alertId]
        );
      } catch { /* DB not available — skip */ }
    },
    {
      connection:  { host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname },
      concurrency: 10,
    },
  );

  worker.on('failed', (job, err) => logger.warn(`Alert eval failed: ${err.message}`));
  logger.info('AlertWorker started');
  return worker;
}

function evalCondition(
  cond:   AlertCondition,
  price:  number,
  signal?: { bias: string; conviction: number } | undefined,
): boolean {
  switch (cond.type) {
    case 'price':
      if (!cond.value) return false;
      if (cond.operator === 'above')  return price >= cond.value;
      if (cond.operator === 'below')  return price <= cond.value;
      return false;

    case 'signal':
      return !!signal && signal.bias === cond.bias;

    case 'confluence':
      return !!signal && !!cond.minScore && signal.conviction >= cond.minScore;

    default:
      return false;
  }
}
