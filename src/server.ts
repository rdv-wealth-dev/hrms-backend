import app from "./app";
import {env} from "./config/env"
import {logger} from "./config/logger"
import { connectDatabase } from "./config/database";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  
  app.listen(env.port, () => {
  logger.info(`Server running on ${env.port}`);
  }
);
}

bootstrap();