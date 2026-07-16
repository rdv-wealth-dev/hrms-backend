import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env"

export const s3Client = new S3Client({
    region: env.awsRegion,
    credentials: {
        accessKeyId: env.awsAccessKeyId,
        secretAccessKey: env.awsSecretKey,
    },
    // Disable automatic CRC32 checksum — browsers can't compute it,
    // causing 400 errors on direct pre-signed URL uploads
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
})