import { httpServer } from './app';
import { env, connectDB, connectRedis, connectKafka } from './config';
import { BotProfileService } from './services/bot-profile.service';

async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();
  await connectKafka();

  // Seed default bot profiles if collection is empty
  await BotProfileService.seedDefaultBots();

  httpServer.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
