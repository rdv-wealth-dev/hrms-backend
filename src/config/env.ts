import dotenv from 'dotenv'
dotenv.config()

export const env = {
    nodeEnv : process.env.NODE_ENV || "development",
    port : Number(process.env.PORT) || 5000,
    connectionString : process.env.MONGO_DB_URI || "",
    connectionStringName : process.env.MONGO_DB_NAME || "hrms_dev",
    jwtSecret : process.env.JWT_SECRET || "",
    jwtRefreshSecret : process.env.JWT_REFRESH_SECRET || "",
    zeptomailApiKey : process.env.ZEPTOMAIL_API_KEY || "",
    zeptomailFromEmail : process.env.ZEPTOMAIL_FROM_EMAIL || "hrms@redvisiontech.com",
    zeptomailFromName : process.env.ZEPTOMAIL_FROM_NAME || "HRMs",
    frontendUrl : process.env.FRONTEND_URL || "http://localhost:5173",
    awsRegion: process.env.AWS_REGION || "ap-south-1",
    awsAccessKeyId : process.env.AWS_ACCESS_KEY_ID || "",
    awsSecretKey : process.env.AWS_SECRET_ACCESS_KEY || "",
    awsS3Bucket : process.env.AWS_S3_BUCKET_NAME || "",

}

// Validation below 

if(!env.connectionString){
    throw new Error(
        "MONGO_CONNECTION_STRING is missing in .env, kindly check!"
    )
}

if(!env.jwtSecret){
    throw new Error(
        "JWT_SECRET missing in .env, kindly check!"
    )
}

if(!env.awsS3Bucket){
    throw new Error(
        "AWS_S3_BUCKET_NAME is missing in .env. Please check the file configuration."
    )
}

if(!env.awsAccessKeyId || !env.awsSecretKey){
    throw new Error(
        "AWS credentials (AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY) are missing in .env."
    )
}