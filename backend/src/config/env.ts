import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/uniclub',

  REDIS_MODE: (process.env.REDIS_MODE || 'standalone') as 'standalone' | 'cluster',

  // Standalone
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  // Cluster
  REDIS_CLUSTER_NODES: process.env.REDIS_CLUSTER_NODES || '', // "host1:6379,host2:6380,host3:6381"

  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Admin-specific settings
  ADMIN_JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  ADMIN_DEFAULT_USERNAME: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',

  // Kafka settings
  KAFKA_ENABLED: process.env.KAFKA_ENABLED === 'true',
  KAFKA_BROKERS: process.env.KAFKA_BROKERS || 'localhost:9092',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'uniclub-backend',
  KAFKA_SSL_ENABLED: process.env.KAFKA_SSL_ENABLED === 'true',
  KAFKA_SASL_USERNAME: process.env.KAFKA_SASL_USERNAME || undefined,
  KAFKA_SASL_PASSWORD: process.env.KAFKA_SASL_PASSWORD || undefined,
};
