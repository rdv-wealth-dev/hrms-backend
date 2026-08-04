import app from "./app";
import {env} from "./config/env.config"
import {logger} from "./config/logger.config"
import { connectDatabase } from "./config/database.config";
import { seedPermissions } from "./database/seeds/permission.seed";
import { startWorker } from "./modules/employee/jobs/import-queue";
import { initializeCountryPlugins } from "./domain/localization/index";

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