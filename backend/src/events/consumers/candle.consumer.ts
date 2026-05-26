/**
 * Nexus V30 — Candle Updated Consumer
 * Kafka topic: nexus.market.candle-updated
 *
 * On candle received:
 *   1. Broadcast price update via WS PriceStreamGateway
 *   2. (Future) Persist to TimescaleDB
 */
import { Kafka, Consumer } from 'kafkajs';
import { Logger } from '../../shared/helpers/logger';
import { TOPICS } from '../topics/index';
import type { CandleUpdatedEvent } from '../../../../packages/shared-types/events/index';

const logger = new Logger('CandleConsumer');

export async function startCandleConsumer(
  onCandle: (event: CandleUpdatedEvent) => Promise<void>
): Promise<Consumer | null> {
  const brokers  = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'nexus-v30-backend';

  try {
    const kafka    = new Kafka({ clientId, brokers, retry: { retries: 3 } });
    const consumer = kafka.consumer({ groupId: 'nexus-candle-ws-bridge' });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.CANDLE_UPDATED, fromBeginning: false });

    consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const envelope = JSON.parse(message.value.toString());
          await onCandle(envelope.data as CandleUpdatedEvent);
        } catch (err: any) {
          logger.warn(`Candle consumer parse error: ${err.message}`);
        }
      },
    });

    logger.info('Candle consumer running');
    return consumer;
  } catch (err: any) {
    logger.warn(`Candle consumer unavailable: ${err.message}`);
    return null;
  }
}
