import app from "./app";
import {env} from "./config/env.config"
import {logger} from "./config/logger.config"
import { connectDatabase } from "./config/database.config";
import { seedPermissions } from "./database/seeds/permission.seed";
import { startWorker } from "./modules/employee/jobs/import-queue";
import { initializeCountryPlugins } from "./domain/localization/index";
import { initAttendanceCron } from "./modules/attendance/jobs/attendance-cron.manager";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  initializeCountryPlugins();

  // Start background database job worker
  startWorker();

  // Initialize customizable daily attendance cron
  await initAttendanceCron();

  // Bind and listen immediately for instant startup
  app.listen(env.port, () => {
    logger.info(`⚡ Server running on port ${env.port} [ready for requests]`);
  });

  // Seed platform permissions in background without delaying server start
  seedPermissions().catch((err) => {
    logger.error("Permission seed error:", err);
  });
};

bootstrap();