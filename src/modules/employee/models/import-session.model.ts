import mongoose, { Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export interface ImportSessionRow {
  rowNumber: number;
  rawData: any;
  mappedData: any;
  status: 'valid' | 'warning' | 'error';
  action: 'create' | 'update' | 'skip';
  messages: string[];
}

export interface ImportSessionDocument extends OrgLevelDocument {
  sessionId: string;
  status: 'queued' | 'validating' | 'ready' | 'committed' | 'failed';
  fileName: string;
  rows: ImportSessionRow[];
  fileBufferBase64?: string;
  attempts?: number;
  maxAttempts?: number;
  lockedAt?: Date;
  lockedBy?: string;
  lastError?: string;
}

const ImportSessionSchema = createOrgLevelSchema<ImportSessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'validating', 'ready', 'committed', 'failed'],
      default: 'queued',
      required: true,
      index: true,
    },
    fileName: { type: String, required: true },
    fileBufferBase64: { type: String },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lastError: { type: String, default: null },
    rows: [
      {
        rowNumber: { type: Number, required: true },
        rawData: { type: mongoose.Schema.Types.Mixed },
        mappedData: { type: mongoose.Schema.Types.Mixed },
        status: {
          type: String,
          enum: ['valid', 'warning', 'error'],
          required: true,
        },
        action: {
          type: String,
          enum: ['create', 'update', 'skip'],
          required: true,
        },
        messages: { type: [String], default: [] },
      },
    ],
  },
  { collection: "import_sessions" }
);

ImportSessionSchema.index({ tenantId: 1, sessionId: 1 });
ImportSessionSchema.index({ status: 1, lockedAt: 1 });

export const ImportSessionModel = mongoose.model<ImportSessionDocument>(
  "ImportSession",
  ImportSessionSchema
);
