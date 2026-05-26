/**
 * Nexus V30 — Kafka config with guard
 * KAFKA_ENABLED=true must be explicitly set, otherwise all Kafka operations are no-ops.
 * This lets the backend boot on Railway free tier without a Kafka service.
 */

const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';

export const kafkaConfig = {
  enabled: KAFKA_ENABLED,
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID ?? 'nexus-v30-backend',
  groupId: process.env.KAFKA_GROUP_ID ?? 'nexus-consumer',
};

// No-op producer for when Kafka is disabled
export const noopProducer = {
  send: async () => {},
  connect: async () => {},
  disconnect: async () => {},
};

// Safe send helper — use this everywhere instead of producer.send() directly
export async function safeSend(producer: any, topic: string, messages: any[]): Promise<void> {
  if (!KAFKA_ENABLED) return;
  try {
    await producer.send({ topic, messages });
  } catch (err: any) {
    console.warn(`[Kafka] Failed to send to ${topic}: ${err.message}`);
  }
}
