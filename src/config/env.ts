import dotenv from 'dotenv'
dotenv.config()

export const env = {
    nodeEnv : process.env.NODE_ENV || "development",
    port : Number(process.env.PORT) || 5000,
    connectionString : process.env.CONNECTION_STRING || "",
    jwtSecret : process.env.JWT_SECRET || "",
    jwtRefreshSecret : process.env.JWT_REFRESH_SECRET || "",
    redisHost : process.env.REDIS_HOST || "",
    redisPort : Number(process.env.REDIS_PORT) || 6379
}

// Validation below 

// if(!env.connectionString){
//     throw new Error(
//         "MONGO_CONNECTION_STRING is missing in .env, kindly check!"
//     )
// }

// if(!env.jwtSecret){
//     throw new Error(
//         "JWT_SECRET missing in .env, kindly check!"
//     )
// }