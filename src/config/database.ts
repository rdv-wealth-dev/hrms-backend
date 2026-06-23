import mongoose from 'mongoose'
import {env} from './env'
import { logger } from './logger'

export const connectDatabase = async(): Promise<void> =>{
    try{
        await mongoose.connect(env.connectionString,{
            dbName: env.connectionStringName,
        });
        logger.info(`Database Connected Successfully (${env.connectionStringName})`);
    } catch(error){
        logger.error(`Database Connection Failed: ${error}`);
        process.exit(1)
    }
}