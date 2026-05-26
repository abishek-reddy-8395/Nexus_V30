/**
 * Nexus V30 — BullMQ Queue Registry
 *
 * All background job queues. Workers process these queues independently.
 * Redis is the queue backend (same Redis instance as cache — separate DB index).
 *
 * Queues:
 *   candle-refresh   — fetch latest OHLCV from external sources
 *   signal-scan      — run SMC engine scan on schedule
 *   alert-eval       — evaluate user alert conditions
 *   ai-narrative     — generate AI narratives (rate-limited)
 *   notification-send— send email/push/in-app notifications
 *   analytics-build  — rebuild aggregated performance stats
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedisClient }             from '../../database/redis/client';
import { Logger }                     from '../../shared/helpers/logger';

const logger = new Logger('Queues');

export const QUEUE_NAMES = {
  CANDLE_REFRESH:    'candle-refresh',
  SIGNAL_SCAN:       'signal-scan',
  ALERT_EVAL:        'alert-eval',
  AI_NARRATIVE:      'ai-narrative',
  NOTIFICATION_SEND: 'notification-send',
  ANALYTICS_BUILD:   'analytics-build',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

const connection = () => ({ host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname });

const _queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  if (_queues.has(name)) return _queues.get(name)!;

  const queue = new Queue(name, {
    connection: connection(),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50  },
      attempts:         3,
      backoff:          { type: 'exponential', delay: 2_000 },
    },
  });

  _queues.set(name, queue);
  logger.debug(`Queue registered: ${name}`);
  return queue;
}

// Convenience: add a job to any queue
export async function enqueue(
  queueName: QueueName,
  jobName:   string,
  data:      unknown,
  opts?:     { delay?: number; priority?: number },
): Promise<void> {
  try {
    const queue = getQueue(queueName);
    await queue.add(jobName, data, opts);
  } catch (err: any) {
    logger.warn(`Failed to enqueue ${jobName} on ${queueName}: ${err.message}`);
  }
}
