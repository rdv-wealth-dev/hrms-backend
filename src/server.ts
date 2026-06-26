import app from "./app";
import {env} from "./config/env"
import {logger} from "./config/logger"
import { connectDatabase } from "./config/database";
import { seedPermissions } from "./modules/permission/permission.seed";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

   // Seed platform permissions on every startup
  // Safe — upsert only, skips existing
  await seedPermissions();
  
  app.listen(env.port, () => {
  logger.info(`Server running on ${env.port}`);
  }
);
}

bootstrap();