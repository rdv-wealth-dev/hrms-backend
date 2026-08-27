import mongoose, { Schema, Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export enum ArrearsBatchStatus {
  DRAFT = "DRAFT",
  PROCESSED = "PROCESSED",
  CANCELLED = "CANCELLED",
}

export interface IArrearsBatchLine {
  employeeId: mongoose.Types.ObjectId;
  amount: number;
  remarks?: string;
}

export interface IArrearsBatch extends OrgLevelDocument {
  batchNumber: string;
  batchName: string;
  reason: string;
  lines: IArrearsBatchLine[];
  totalAmount: number;
  totalEmployees: number;
  status: ArrearsBatchStatus;
  effectiveYear?: number;
  effectiveMonth?: number;
  createdBy: mongoose.Types.ObjectId;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
}

const arrearsBatchLineSchema = new Schema<IArrearsBatchLine>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const arrearsBatchSchema = createOrgLevelSchema<IArrearsBatch>(
  {
    batchNumber: {
      type: String,
      required: true,
      index: true,
    },
    batchName: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    lines: [arrearsBatchLineSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalEmployees: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(ArrearsBatchStatus),
      default: ArrearsBatchStatus.DRAFT,
      index: true,
    },
    effectiveYear: {
      type: Number,
      index: true,
    },
    effectiveMonth: {
      type: Number,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
  },
  {
    collection: "payroll_arrears_batches",
    timestamps: true,
  }
);

arrearsBatchSchema.index({ tenantId: 1, batchNumber: 1 }, { unique: true });
arrearsBatchSchema.index({ tenantId: 1, status: 1 });

export const ArrearsBatchModel = mongoose.model<IArrearsBatch>(
  "ArrearsBatch",
  arrearsBatchSchema
);
