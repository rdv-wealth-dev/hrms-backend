import {createClient,RedisClientType} from "redis";
import {env} from "./env"
import { logger } from "./logger";

let redisClient: RedisClientType;

export const connectRedis = async(): Promise<void> =>{
try{
    redisClient = createClient({
        url : `redis://${env.redisHost}:${env.redisPort}`,
    });

    redisClient.on("error",(error)=>{
        logger.error(`Redis Error: ${error}`)
    });

    await redisClient.connect();
    logger.info("Redis Connected Successfully");
    
    } catch(error){
        logger.error(`Redis Connection Failed: ${error}`);
    }
}

export {redisClient};