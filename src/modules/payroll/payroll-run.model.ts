import mongoose from "mongoose";
import { createBaseSchema, BaseDocument, } from "../../core/database/base.schema";

// A payroll run is one monthly batch — HR triggers it, the system pulls
// every active employee's salary structure + that month's attendance/leave
// data, generates a Payslip per employee, and the run itself tracks the
// batch-level status/approval (matches the same maker-checker pattern
// flagged as mandatory for payroll in the earlier security discussion).

export enum PayrollRunStatus {
  DRAFT      = "DRAFT",       // created, payslips not yet generated
  PROCESSING = "PROCESSING",  // payslips being generated
  GENERATED  = "GENERATED",   // payslips ready, awaiting approval
  APPROVED   = "APPROVED",    // approved, considered final/immutable
  PAID       = "PAID",        // marked as disbursed
  CANCELLED  = "CANCELLED",
}

export interface PayrollRunDocument extends BaseDocument {
  month:              number;   // 1-12
  year:               number;
  runLabel:           string;   // "June 2026" — denormalized for display
  status:             PayrollRunStatus;
  totalEmployees:     number;
  totalGrossAmount:   number;
  totalDeductionsAmount: number;
  totalNetAmount:     number;
  generatedAt?:       Date;
  approvedBy?:        mongoose.Types.ObjectId;
  approvedAt?:        Date;
  paidAt?:            Date;
  notes?:             string;
}

const PayrollRunSchema = createBaseSchema<PayrollRunDocument>(
  {
    month: {
      type:     Number,
      required: true,
      min:      1,
      max:      12,
    },
    year: {
      type:     Number,
      required: true,
    },
    runLabel: {
      type:     String,
      required: true,
      trim:     true,
    },
    status: {
      type:    String,
      enum:    Object.values(PayrollRunStatus),
      default: PayrollRunStatus.DRAFT,
    },
    totalEmployees:         { type: Number, default: 0 },
    totalGrossAmount:       { type: Number, default: 0 },
    totalDeductionsAmount:  { type: Number, default: 0 },
    totalNetAmount:         { type: Number, default: 0 },
    generatedAt:            { type: Date },
    approvedBy:              { type: mongoose.Schema.Types.ObjectId },
    approvedAt:              { type: Date },
    paidAt:                  { type: Date },
    notes:                   { type: String, trim: true },
  },
  { collection: "payroll_runs" }
);

// One run per branch per month — immutable once APPROVED (enforced at service layer)
PayrollRunSchema.index({ tenantId: 1, branchId: 1, year: 1, month: 1 }, { unique: true });
PayrollRunSchema.index({ tenantId: 1, status: 1 });

export const PayrollRunModel = mongoose.model<PayrollRunDocument>(
  "PayrollRun",
  PayrollRunSchema
);