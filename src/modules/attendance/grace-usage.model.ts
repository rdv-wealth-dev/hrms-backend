import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export interface GraceUsageDocument extends BaseDocument {
  employeeId: mongoose.Types.ObjectId;
  year:       number;
  month:      number;   // 1-12
  used:       number;   // how many grace periods consumed this month
}

const GraceUsageSchema = createBaseSchema<GraceUsageDocument>({
  employeeId: {
    type:     mongoose.Schema.Types.ObjectId,
    required: true,
    index:    true,
  },
  year: {
    type:     Number,
    required: true,
  },
  month: {
    type:     Number,
    required: true,
    min:      1,
    max:      12,
  },
  used: {
    type:    Number,
    default: 0,
    min:     0,
  },
}, { collection: "grace_usage" });

GraceUsageSchema.index(
  { tenantId: 1, employeeId: 1, year: 1, month: 1 },
  { unique: true }
);

export const GraceUsageModel = mongoose.model<GraceUsageDocument>(
  "GraceUsage",
  GraceUsageSchema
);
