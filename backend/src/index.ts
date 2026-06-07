import { httpServer } from './app';
import { env, connectDB, connectRedis, connectKafka } from './config';
import { BotProfileService } from './services/bot-profile.service';
import { WeeklyEventSchedulerService } from './games/weekly-event/services';

async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();
  await connectKafka();

  // Seed default bot profiles if collection is empty
  await BotProfileService.seedDefaultBots();

  // Khởi động Weekly Event scheduler sau khi DB/Redis đã sẵn sàng
  WeeklyEventSchedulerService.startScheduler();

  httpServer.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
