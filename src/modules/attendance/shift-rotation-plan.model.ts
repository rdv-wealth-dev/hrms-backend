import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export enum CycleDuration {
  WEEKLY   = "WEEKLY",    // each slot lasts exactly 7 days (most common)
  BIWEEKLY = "BIWEEKLY", // each slot lasts 14 days
  MONTHLY  = "MONTHLY",  // each slot lasts ~30 days (approximated as 30)
}

export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
] as const;

export type DayName = typeof DAY_NAMES[number];

// ─── INTERFACES ───────────────────────────────────────────────────────────────

// One slot in a rotation plan — e.g. "Morning shift, Sat-Sun off"
export interface RotationSlot {
  order:    number;                  // 1-based; determines the cycle sequence
  shiftId:  mongoose.Types.ObjectId; // references ShiftModel
  offDays:  DayName[];               // rest days while this slot is active
}

export interface ShiftRotationPlanDocument extends OrgLevelDocument {
  name:          string;
  description?:  string;
  cycleDuration: CycleDuration;
  slots:         RotationSlot[];   // at least 2 — a single-slot plan is just a fixed shift
  isActive:      boolean;
}

// ─── SLOT SCHEMA ─────────────────────────────────────────────────────────────

const RotationSlotSchema = new mongoose.Schema(
  {
    order: {
      type:     Number,
      required: true,
      min:      1,
      max:      12,
    },
    shiftId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Shift",
      required: true,
    },
    offDays: {
      type:    [String],
      default: [],
      // validated in DTO — stored as-is
    },
  },
  { _id: false }
);

// ─── PLAN SCHEMA ──────────────────────────────────────────────────────────────

const ShiftRotationPlanSchema = createOrgLevelSchema<ShiftRotationPlanDocument>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    cycleDuration: {
      type:    String,
      enum:    Object.values(CycleDuration),
      default: CycleDuration.WEEKLY,
    },
    slots: {
      type:     [RotationSlotSchema],
      validate: {
        validator: (v: RotationSlot[]) => v.length >= 2,
        message:   "A rotation plan must have at least 2 slots",
      },
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "shift_rotation_plans" }
);

// ─── INDEXES ──────────────────────────────────────────────────────────────────

ShiftRotationPlanSchema.index({ tenantId: 1, isActive: 1 });
ShiftRotationPlanSchema.index({ tenantId: 1, name: 1 });

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export const ShiftRotationPlanModel = mongoose.model<ShiftRotationPlanDocument>(
  "ShiftRotationPlan",
  ShiftRotationPlanSchema
);
