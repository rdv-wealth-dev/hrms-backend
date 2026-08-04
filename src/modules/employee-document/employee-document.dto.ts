import { z } from "zod";
import {
  safeStringSchema,
  objectIdSchema,
  dateSchema,
} from "../../shared/validators/common.validator";

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function assertValidDocumentFile(
  mimeType: string,
  sizeBytes: number
): void {
  const normalized = (mimeType || "").trim().toLowerCase();
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(normalized as any)) {
    throw new Error(
      `Unsupported file type "${mimeType}". Allowed types: JPG, JPEG, PNG, PDF only.`
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("File size is missing or invalid.");
  }
  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `File size ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB exceeds the 10 MB limit.`
    );
  }
}

// Add Document
export const AddDocumentDto = z.object({
  documentType: z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ]),
  fileName:   safeStringSchema(1, 255),
  s3Key:      safeStringSchema(1, 500),
  mimeType:   safeStringSchema(1, 100),
  sizeBytes:  z.number().min(1).max(MAX_DOCUMENT_SIZE_BYTES),
  expiryDate: dateSchema.optional(),
});

export type AddDocumentInput = z.infer<typeof AddDocumentDto>;

// Request Upload URL
export const RequestUploadUrlDto = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  documentType: z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ]),
}).refine(
  (v) => ALLOWED_DOCUMENT_MIME_TYPES.includes(v.mimeType.trim().toLowerCase() as any),
  { message: "Unsupported file type. Allowed types: JPG, JPEG, PNG, PDF only." }
);

export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlDto>;

// Verify Document
export const VerifyDocumentDto = z.object({
  isVerified: z.boolean(),
  remarks:    z.string().trim().max(500).optional(),
});

export type VerifyDocumentInput = z.infer<typeof VerifyDocumentDto>;

// Upload Document (Direct multipart upload)
export const UploadDocumentDto = z.object({
  documentType: z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ]),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentDto>;
