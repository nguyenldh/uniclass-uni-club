import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('[DB] MongoDB connected');
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error);
    process.exit(1);
  }
}
