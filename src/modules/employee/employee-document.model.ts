import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export enum DocumentType {
  PAN             = "PAN",
  AADHAAR         = "AADHAAR",
  PASSPORT        = "PASSPORT",
  DRIVING_LICENSE = "DRIVING_LICENSE",
  OFFER_LETTER    = "OFFER_LETTER",
  RESUME          = "RESUME",
  DEGREE          = "DEGREE",
  EXPERIENCE      = "EXPERIENCE",
  OTHER           = "OTHER",
}

export interface EmployeeDocumentRecord extends BaseDocument {
  employeeId:   mongoose.Types.ObjectId;
  documentType: DocumentType;
  fileName:     string;
  s3Key:        string;    // S3 object key — never a permanent URL
  mimeType:     string;
  sizeBytes:    number;
  uploadedBy:   mongoose.Types.ObjectId;
  expiryDate?:  Date;      // for passport, driving license etc.
  isVerified:   boolean;
}

const EmployeeDocumentSchema = createBaseSchema<EmployeeDocumentRecord>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    documentType: {
      type:     String,
      required: true,
      enum:     Object.values(DocumentType),
    },
    fileName: {
      type:     String,
      required: true,
      trim:     true,
    },
    s3Key: {
      // Never store the full URL — generate pre-signed URL on demand
      type:     String,
      required: true,
      trim:     true,
    },
    mimeType: {
      type:     String,
      required: true,
      trim:     true,
    },
    sizeBytes: {
      type:    Number,
      default: 0,
    },
    uploadedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
    },
    expiryDate: { type: Date },
    isVerified: {
      type:    Boolean,
      default: false,
    },
  },
  { collection: "employee_documents" }
);

EmployeeDocumentSchema.index({ tenantId: 1, employeeId: 1 });
EmployeeDocumentSchema.index({ tenantId: 1, employeeId: 1, documentType: 1 });

export const EmployeeDocumentModel =
  mongoose.model<EmployeeDocumentRecord>(
    "EmployeeDocument",
    EmployeeDocumentSchema
  );