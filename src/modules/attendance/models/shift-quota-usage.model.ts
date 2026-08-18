import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../shared/database/base.schema";

// Tracks how many times per month an employee has consumed:
//   - lateCount       : arrived after grace period (status = LATE)
//   - earlyLeaveCount : checked out within the earlyLeaveStartTime→endTime window
//
// These counts are compared against the shift's lateArrivalQuotaPerMonth and
// earlyLeaveQuotaPerMonth to surface HR alerts. Punches are NEVER blocked.
// One document per employee per calendar month.

export interface ShiftQuotaUsageDocument extends BaseDocument {
  employeeId: mongoose.Types.ObjectId;
  shiftId: mongoose.Types.ObjectId;
  year: number;
  month: number;   // 1-12
  lateCount: number;   // times arrived LATE (after grace, before absentThreshold)
  earlyLeaveCount: number;   // times checked out within allowed early-leave window
}

const ShiftQuotaUsageSchema = createBaseSchema<ShiftQuotaUsageDocument>({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
    index: true,
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  lateCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  earlyLeaveCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { collection: "shift_quota_usage" });

// One record per employee per month — compound unique index
ShiftQuotaUsageSchema.index(
  { tenantId: 1, employeeId: 1, year: 1, month: 1 },
  { unique: true }
);
ShiftQuotaUsageSchema.index({ tenantId: 1, shiftId: 1, year: 1, month: 1 });

export const ShiftQuotaUsageModel = mongoose.model<ShiftQuotaUsageDocument>(
  "ShiftQuotaUsage",
  ShiftQuotaUsageSchema
);
