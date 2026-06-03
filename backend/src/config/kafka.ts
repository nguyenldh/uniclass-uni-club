import { Kafka, Producer, logLevel } from 'kafkajs';
import { env } from './env';

let kafka: Kafka | null = null;
let producer: Producer | null = null;

function createKafkaClient(): Kafka | null {
  if (!env.KAFKA_ENABLED) {
    console.log('[Kafka] Disabled via KAFKA_ENABLED=false');
    return null;
  }

  const brokers = env.KAFKA_BROKERS.split(',').map((b) => b.trim());
  const sslEnabled = env.KAFKA_SSL_ENABLED;
  const saslUsername = env.KAFKA_SASL_USERNAME;
  const saslPassword = env.KAFKA_SASL_PASSWORD;

  // SASL authentication requires SSL
  const saslConfig =
    sslEnabled && saslUsername && saslPassword
      ? { mechanism: 'plain' as const, username: saslUsername, password: saslPassword }
      : undefined;

  if (saslUsername && saslPassword && !sslEnabled) {
    console.warn('[Kafka] SASL credentials provided but SSL is disabled. SASL requires SSL — credentials will be ignored.');
  }

  return new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers,
    ssl: sslEnabled,
    sasl: saslConfig,
    logLevel: logLevel.WARN,
  });
}

export function getKafkaProducer(): Producer | null {
  return producer;
}

export async function connectKafka(): Promise<void> {
  if (!env.KAFKA_ENABLED) {
    console.log('[Kafka] Skipping connection (disabled)');
    return;
  }

  try {
    kafka = createKafkaClient();
    if (!kafka) return;

    producer = kafka.producer();
    await producer.connect();
    console.log(`[Kafka] Producer connected to ${env.KAFKA_BROKERS}`);
  } catch (error) {
    console.error('[Kafka] Connection error:', error);
    // Non-blocking: Kafka failure should not crash the server
    producer = null;
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    try {
      await producer.disconnect();
      console.log('[Kafka] Producer disconnected');
    } catch (error) {
      console.error('[Kafka] Disconnect error:', error);
    }
  }
}
