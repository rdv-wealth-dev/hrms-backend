import app from "./app";
import {env} from "./config/env"
import {logger} from "./config/logger"
import { connectDatabase } from "./config/database";
import { seedPermissions } from "./modules/permission/permission.seed";
import { startWorker } from "./modules/employee/core/import-queue";
import { initializeCountryPlugins } from "./countries";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  initializeCountryPlugins();

   // Seed platform permissions on every startup
  // Safe — upsert only, skips existing
  await seedPermissions();
  
  // Start background database job worker
  startWorker();
  
  app.listen(env.port, () => {
    logger.info(`Server running on ${env.port}`);
  });
}

bootstrap();