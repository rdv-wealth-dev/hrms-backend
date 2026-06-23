import app from "./app";
import {env} from "./config/env"
import {logger} from "./config/logger"
import { connectDatabase } from "./config/database";
import { connectRedis } from "./config/redis";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  await connectRedis();
  
  app.listen(env.port, () => {
  logger.info(`Server running on ${env.port}`);
  }
);
}

bootstrap();