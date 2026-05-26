/**
 * Nexus V30 — Kafka Event Producer
 *
 * Central event bus producer. All services use this to emit events.
 * Falls back to a no-op in development if Kafka is unavailable.
 */

import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { Logger } from '../../shared/helpers/logger';
import { Topic }  from '../topics/index';

const logger = new Logger('EventProducer');

let _producer: Producer | null = null;
let _connected = false;

async function getProducer(): Promise<Producer | null> {
  if (_producer && _connected) return _producer;

  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'nexus-v30-backend';

  try {
    const kafka  = new Kafka({ clientId, brokers, retry: { retries: 3 } });
    _producer    = kafka.producer({ allowAutoTopicCreation: true });
    await _producer.connect();
    _connected   = true;
    logger.info('Kafka producer connected');
    return _producer;
  } catch (err: any) {
    logger.warn(`Kafka unavailable (${err.message}) — events will be no-op`);
    return null;
  }
}

export async function emit(topic: Topic, message: unknown, key?: string): Promise<void> {
  const producer = await getProducer();
  if (!producer) return;  // no-op in dev without Kafka

  try {
    await producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [{
        key:   key ?? null,
        value: JSON.stringify({ data: message, ts: Date.now() }),
      }],
    });
  } catch (err: any) {
    logger.warn(`Failed to emit ${topic}: ${err.message}`);
  }
}

export async function emitBatch(topic: Topic, messages: Array<{ key?: string; value: unknown }>): Promise<void> {
  const producer = await getProducer();
  if (!producer) return;

  try {
    await producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: messages.map(m => ({
        key:   m.key ?? null,
        value: JSON.stringify({ data: m.value, ts: Date.now() }),
      })),
    });
  } catch (err: any) {
    logger.warn(`Failed to emit batch to ${topic}: ${err.message}`);
  }
}
