import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../core/database/base.schema";

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE LOCK STATUS ENUM
// ─────────────────────────────────────────────────────────────────────────────

export enum AttendanceLockStatus {
  UNLOCKED = "UNLOCKED",
  LOCKED   = "LOCKED",
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE LOCK MODEL
// Asserts if a branch's attendance has been finalized/locked for a monthly period.
// Payroll runs check this status before proceeding.
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceLockDocument extends BaseDocument {
  branchId: mongoose.Types.ObjectId;
  period:   string; // Format: "YYYY-MM" (e.g. "2026-07")
  status:   AttendanceLockStatus;
  lockedBy?: mongoose.Types.ObjectId;
  lockedAt?: Date;
}

const AttendanceLockSchema = createBaseSchema<AttendanceLockDocument>(
  {
    branchId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      ref:      "Branch",
      index:    true,
    },
    period: {
      type:     String,
      required: true,
      trim:     true,
      index:    true,
    },
    status: {
      type:    String,
      enum:    Object.values(AttendanceLockStatus),
      default: AttendanceLockStatus.UNLOCKED,
      index:   true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
    lockedAt: {
      type: Date,
    },
  },
  { collection: "attendance_locks" }
);

AttendanceLockSchema.index({ tenantId: 1, branchId: 1, period: 1 }, { unique: true });

export const AttendanceLockModel = mongoose.model<AttendanceLockDocument>(
  "AttendanceLock",
  AttendanceLockSchema
);
