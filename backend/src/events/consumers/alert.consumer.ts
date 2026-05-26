/**
 * Nexus V30 — Alert Triggered Consumer
 * Kafka topic: nexus.alerts.alert-triggered
 *
 * Broadcasts triggered alerts to connected WS clients.
 */
import { Kafka, Consumer } from 'kafkajs';
import { Logger } from '../../shared/helpers/logger';
import { TOPICS } from '../topics/index';

const logger = new Logger('AlertConsumer');

export interface AlertTriggeredEvent {
  id:         string;
  userId:     string;
  tenantId:   string;
  sym:        string;
  type:       string;
  condition:  Record<string, any>;
  triggeredAt:number;
  message:    string;
}

export async function startAlertConsumer(
  onAlert: (event: AlertTriggeredEvent) => Promise<void>
): Promise<Consumer | null> {
  const brokers  = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'nexus-v30-backend';

  try {
    const kafka    = new Kafka({ clientId, brokers, retry: { retries: 3 } });
    const consumer = kafka.consumer({ groupId: 'nexus-alert-ws-bridge' });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.ALERT_TRIGGERED, fromBeginning: false });

    consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const envelope = JSON.parse(message.value.toString());
          await onAlert(envelope.data as AlertTriggeredEvent);
        } catch (err: any) {
          logger.warn(`Alert consumer parse error: ${err.message}`);
        }
      },
    });

    logger.info('Alert consumer running');
    return consumer;
  } catch (err: any) {
    logger.warn(`Alert consumer unavailable: ${err.message}`);
    return null;
  }
}
