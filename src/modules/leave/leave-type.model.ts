import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../core/database/base.schema";

export enum LeaveAccrualFrequency {
  MONTHLY = "MONTHLY",
  YEARLY  = "YEARLY",
  NONE    = "NONE",
}

// Per-branch override of entitlement — same leave type, different quota
// per location, e.g. "Annual Leave: Mumbai 18 days, Dubai 30 days"
export interface BranchEntitlementOverride {
  branchId:    mongoose.Types.ObjectId;
  annualQuota: number;
}

export interface LeaveTypeDocument extends BaseDocument {
  name:                  string;
  code:                  string;
  description:           string;
  isPaid:                boolean;
  annualQuota:           number;   // default/org-wide quota
  branchOverrides:       BranchEntitlementOverride[];  // branch-specific quotas
  accrualFrequency:      LeaveAccrualFrequency;
  accrualAmountPerCycle: number;
  maxCarryForwardDays:   number;
  maxConsecutiveDays:    number;   // 0 = no limit
  advanceNoticeDays:     number;   // 0 = no advance notice required
  minAdvanceNoticeDays:  number;   // for windowed notice like "7-15 days"
  requiresApproval:      boolean;
  approvalLevels:        number;   // 1, 2, or 3 — how many sign-offs required
  allowNegativeBalance:  boolean;
  probationEligible:     boolean;  // can employees still on probation use this type?
  applySandwichPolicy:   boolean;  // deduct holidays/weekoffs sandwiched between leave days
  isActive:              boolean;
  effectiveFrom: Date;
  effectiveTo: Date;
  supersedes?: mongoose.Types.ObjectId;
}

const BranchOverrideSchema = new mongoose.Schema(
  {
    branchId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    annualQuota: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const LeaveTypeSchema = createBaseSchema<LeaveTypeDocument>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },
    code: {
      type:      String,
      required:  true,
      trim:      true,
      uppercase: true,
      maxlength: 10,
    },
    description: {
      type:    String,
      trim:    true,
      default: "",
    },
    isPaid: {
      type:    Boolean,
      default: true,
    },
    annualQuota: {
      type:     Number,
      required: true,
      min:      0,
    },
    branchOverrides: {
      // Empty array = same quota applies to every branch
      type:    [BranchOverrideSchema],
      default: [],
    },
    accrualFrequency: {
      type:    String,
      enum:    Object.values(LeaveAccrualFrequency),
      default: LeaveAccrualFrequency.NONE,
    },
    accrualAmountPerCycle: {
      type:    Number,
      default: 0,
      min:     0,
    },
    maxCarryForwardDays: {
      type:    Number,
      default: 0,
      min:     0,
    },
    maxConsecutiveDays: {
      type:    Number,
      default: 0,
      min:     0,
    },
    advanceNoticeDays: {
      // Minimum days notice required before the leave start date.
      // 0 = can apply same day (e.g. sick leave, emergency leave)
      type:    Number,
      default: 0,
      min:     0,
    },
    minAdvanceNoticeDays: {
      // For policies like "7-15 days notice window" —
      // advanceNoticeDays acts as the lower bound already;
      // this field is the upper bound of that window, 0 = no upper bound
      type:    Number,
      default: 0,
      min:     0,
    },
    requiresApproval: {
      type:    Boolean,
      default: true,
    },
    approvalLevels: {
      // 1 = Manager only, 2 = Manager + HR, 3 = Manager + HR + Director
      type:    Number,
      default: 1,
      min:     1,
      max:     3,
    },
    allowNegativeBalance: {
      type:    Boolean,
      default: false,
    },
    probationEligible: {
      type:    Boolean,
      default: false,
    },
    applySandwichPolicy: {
      type:    Boolean,
      default: false,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    effectiveFrom: {
      type: Date,
      default: () => new Date(),
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { collection: "leave_types" }
);

LeaveTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LeaveTypeSchema.index({ tenantId: 1, isActive: 1 });

export const LeaveTypeModel = mongoose.model<LeaveTypeDocument>(
  "LeaveType",
  LeaveTypeSchema
);