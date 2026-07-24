import mongoose from 'mongoose'
import {env} from './env'
import { logger } from './logger'

export const connectDatabase = async(): Promise<void> =>{
    try{
        await mongoose.connect(env.connectionString,{
            dbName: env.connectionStringName,
            maxPoolSize: 50, // Maintain up to 50 active socket connections
            minPoolSize: 10,  // Keep at least 10 sockets open and warm
        });
        logger.info(`Database Connected Successfully (${env.connectionStringName})`);
    } catch(error){
        logger.error(`Database Connection Failed: ${error}`);
        process.exit(1)
    }
}