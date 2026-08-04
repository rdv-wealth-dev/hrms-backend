import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from './logger.config';

// Setup Mongoose Event Listeners
const setupEventListeners = (): void => {
  mongoose.connection.on('connected', () => {
    logger.info('Mongoose: Connected to database cluster');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`Mongoose: Connection error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose: Database connection lost');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('Mongoose: Reconnected to database');
  });
};

export const connectDatabase = async (): Promise<void> => {
  // Prevent duplicate connection attempts if already connected or connecting
  if (mongoose.connection.readyState === 1) {
    logger.info('Database is already connected.');
    return;
  }

  setupEventListeners();

  try {
    await mongoose.connect(env.connectionString, {
      dbName: env.connectionStringName,
      maxPoolSize: 50,              // Up to 50 sockets for concurrent requests
      minPoolSize: 10,              // Keep 10 warm sockets ready
      serverSelectionTimeoutMS: 5000, // Fast fail (5s) if MongoDB cluster is unreachable
      socketTimeoutMS: 45000,       // Close idle sockets after 45s
      autoIndex: env.nodeEnv !== 'production', // Disable automatic index builds in production for performance
    });

    logger.info(`Database Connected Successfully (${env.connectionStringName})`);
  } catch (error) {
    logger.error(`Database Connection Failed: ${error}`);
    process.exit(1);
  }
};

/**
 * Gracefully close the database connection upon application termination.
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('Database connection closed cleanly.');
  } catch (error) {
    logger.error(`Error closing database connection: ${error}`);
  }
};

// Handle process termination signals for graceful shutdown
const handleGracefulShutdown = (signal: string) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}. Closing database connection...`);
    await disconnectDatabase();
    process.exit(0);
  });
};

handleGracefulShutdown('SIGINT');
handleGracefulShutdown('SIGTERM');