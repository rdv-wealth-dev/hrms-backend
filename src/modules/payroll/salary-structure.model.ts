import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

// One salary structure per employee, effective-dated — same versioning
// pattern we just applied to LeaveType. A salary revision creates a new
// structure with a new effectiveFrom, it never mutates history, since
// payroll runs must always reference the structure that was actually
// active for that specific month.

export interface SalaryLineItem {
    componentId : mongoose.Types.ObjectId;
    componentCode : string;     // denormalized for fast payslip rendering
    amount : number;        // resolved monthly amount for this component
}

export interface SalaryStructureDocument extends BaseDocument {
    employeeId:      mongoose.Types.ObjectId;
    effectiveFrom:   Date;
    effectiveTo?:    Date;      // null = currently active
    supersedes?:     mongoose.Types.ObjectId;
    ctcAnnual:       number;    // total annual CTC this structure represents
    lineItems:       SalaryLineItem[];
    grossMonthly:    number;    // sum of EARNING components
    totalDeductionsMonthly: number;  // sum of DEDUCTION components (excl. attendance-based LOP)
    netMonthly:      number;    // gross - deductions, before LOP is applied at run time
    wagesForStatutory: number;  // recalculated "wages" figure per 50% rule — used for PF/ESI/gratuity base
    isActive:        boolean;
}

const SalaryLineItemSchema = new mongoose.Schema(
  {
    componentId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    componentCode: { type: String, required: true, uppercase: true },
    amount:        { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SalaryStructureSchema = createBaseSchema<SalaryStructureDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    effectiveFrom: {
      type:     Date,
      required: true,
    },
    effectiveTo: {
      type:    Date,
      default: null,
    },
    supersedes: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ctcAnnual: {
      type:     Number,
      required: true,
      min:      0,
    },
    lineItems: {
      type:    [SalaryLineItemSchema],
      default: [],
    },
    grossMonthly: {
      type:     Number,
      required: true,
      min:      0,
    },
    totalDeductionsMonthly: {
      type:    Number,
      default: 0,
      min:     0,
    },
    netMonthly: {
      type:     Number,
      required: true,
      min:      0,
    },
    wagesForStatutory: {
      type:     Number,
      required: true,
      min:      0,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "salary_structures" }
);

// One active structure per employee at a time — enforced at the service
// layer (close out old before creating new), but this compound index
// makes the "find currently active" lookup fast.

SalaryStructureSchema.index({ tenantId: 1, employeeId: 1, effectiveTo: 1 });
SalaryStructureSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });

export const SalaryStructureModel = mongoose.model<SalaryStructureDocument>(
  "SalaryStructure",
  SalaryStructureSchema
);