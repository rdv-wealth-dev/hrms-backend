import mongoose, { Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export interface ExportSessionDocument extends OrgLevelDocument {
  userId: mongoose.Types.ObjectId;
  filters: any;
  fieldsIncluded: string[];
  fileName: string;
  downloadUrl?: string;
  downloadedAt?: Date;
}

const ExportSessionSchema = createOrgLevelSchema<ExportSessionDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    fieldsIncluded: { type: [String], default: [] },
    fileName: { type: String, required: true },
    downloadUrl: { type: String },
    downloadedAt: { type: Date },
  },
  { collection: "export_sessions" }
);

ExportSessionSchema.index({ tenantId: 1, userId: 1 });

export const ExportSessionModel = mongoose.model<ExportSessionDocument>(
  "ExportSession",
  ExportSessionSchema
);
