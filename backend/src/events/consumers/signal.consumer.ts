/**
 * Nexus V30 — Signal Generated Consumer
 * Kafka topic: nexus.engine.signal-generated
 *
 * On signal received:
 *   1. Broadcast via WS SignalGateway to all connected clients
 *   2. Evaluate against active user alerts
 */
import { Kafka, Consumer } from 'kafkajs';
import { Logger } from '../../shared/helpers/logger';
import { TOPICS } from '../topics/index';
import type { SignalGeneratedEvent } from '../../../../packages/shared-types/events/index';

const logger = new Logger('SignalConsumer');

export async function startSignalConsumer(
  onSignal: (event: SignalGeneratedEvent) => Promise<void>
): Promise<Consumer | null> {
  const brokers  = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'nexus-v30-backend';

  try {
    const kafka    = new Kafka({ clientId, brokers, retry: { retries: 3 } });
    const consumer = kafka.consumer({ groupId: 'nexus-signal-ws-bridge' });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.SIGNAL_GENERATED, fromBeginning: false });

    consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const envelope = JSON.parse(message.value.toString());
          await onSignal(envelope.data as SignalGeneratedEvent);
        } catch (err: any) {
          logger.warn(`Signal consumer parse error: ${err.message}`);
        }
      },
    });

    logger.info('Signal consumer running');
    return consumer;
  } catch (err: any) {
    logger.warn(`Signal consumer unavailable: ${err.message}`);
    return null;
  }
}
