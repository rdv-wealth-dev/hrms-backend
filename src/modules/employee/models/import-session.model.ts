import mongoose, { Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export type ImportRowStatus =
  | 'valid'
  | 'warning'
  | 'error'
  | 'CLEAN'
  | 'IMPORTED_INCOMPLETE'
  | 'POSSIBLE_DUPLICATE'
  | 'REJECTED';

export interface ImportSessionRow {
  rowNumber: number;
  rawData: any;
  mappedData: any;
  status: ImportRowStatus;
  action: 'create' | 'update' | 'skip';
  needsAttentionFields?: string[];
  rejectionReason?: string;
  messages: string[];
}

export interface ImportSessionDocument extends OrgLevelDocument {
  sessionId: string;
  status: 'queued' | 'validating' | 'ready' | 'committed' | 'failed';
  fileName: string;
  rows: ImportSessionRow[];
  totalRows?: number;
  greenCount?: number;
  yellowCount?: number;
  orangeCount?: number;
  redCount?: number;
  committedCount?: number;
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
    totalRows: { type: Number, default: 0 },
    greenCount: { type: Number, default: 0 },
    yellowCount: { type: Number, default: 0 },
    orangeCount: { type: Number, default: 0 },
    redCount: { type: Number, default: 0 },
    committedCount: { type: Number, default: 0 },
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
          enum: ['valid', 'warning', 'error', 'CLEAN', 'IMPORTED_INCOMPLETE', 'POSSIBLE_DUPLICATE', 'REJECTED'],
          required: true,
        },
        action: {
          type: String,
          enum: ['create', 'update', 'skip'],
          required: true,
        },
        needsAttentionFields: { type: [String], default: [] },
        rejectionReason: { type: String, default: null },
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
