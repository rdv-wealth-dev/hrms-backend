import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { s3Client } from "../config/s3";
import { env } from "../config/env"

const UPLOAD_URL_EXPIRY_SECONDS = 300;  // 5 min to complete the upload
const DOWNLOAD_URL_EXPIRY_SECONDS = 900;    // 15 min to view/download

export class S3Service {
    // Generate the S3 key — deterministic, scoped, never guessable
    // Structure: tenants/{tenantId}/employees/{employeeId}/documents/{uuid}-{filename}
    // Scoping by tenantId in the key itself is a second layer of isolation on
    // top of application-level tenant checks — even a leaked key reveals
    // nothing usable without S3 credentials, and stays organized per tenant.

    buildDocumentKey(tenantId: string, employeeId: string, fileName: string): string {
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const unique = crypto.randomBytes(8).toString("hex");
        return `tenants/${tenantId}/employees/${employeeId}/documents/${unique}-${safeFileName}`;
    }

    //Pre-signed PUT URL — client uploads directly to S3, server never sees bytes
    async getUploadUrl(
        s3Key : string,
        mimeType : string
    ): Promise<{ uploadUrl : string; expiresIn : number}> {
        const command = new PutObjectCommand({
            Bucket : env.awsS3Bucket,
            Key : s3Key,
            ContentType : mimeType,
            // Server-side encryption at rest — matches the "S3 with server-side
            // encryption" requirement from the security baseline discussion
            ServerSideEncryption: "AES256",
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: UPLOAD_URL_EXPIRY_SECONDS
        });

        return { uploadUrl, expiresIn: UPLOAD_URL_EXPIRY_SECONDS};
    }

    // ─── Pre-signed GET URL — short-lived, generated on demand for viewing ────
    // Never store a permanent public URL anywhere — this is regenerated
    // every time someone actually wants to view the document.
    async getDownloadUrl(s3Key : string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket : env.awsS3Bucket,
            Key : s3Key,
        });

        return getSignedUrl(s3Client, command, {
            expiresIn : DOWNLOAD_URL_EXPIRY_SECONDS,
        });
    }


    // Delete — called when a document record is hard-removed from S3
    // Note: your employee-document soft-delete (isDeleted: true) does NOT
    // call this — soft-deleted documents stay in S3 for audit/recovery.
    // Only call this for genuine permanent removal, e.g. a data-retention job.
    async deleteObject(s3Key : string): Promise<void>{
        const command = new DeleteObjectCommand({
            Bucket : env.awsS3Bucket,
            Key : s3Key,
        });
        await s3Client.send(command);
    }
}

export const s3Service = new S3Service();