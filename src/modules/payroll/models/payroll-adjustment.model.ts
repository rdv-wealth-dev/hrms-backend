import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../../shared/database/base.schema";

export enum AdjustmentType {
  EARNING = "EARNING",
  DEDUCTION = "DEDUCTION",
}

export enum AdjustmentCategory {
  BONUS = "BONUS",
  COMMISSION = "COMMISSION",
  INCENTIVE = "INCENTIVE",
  ARREARS = "ARREARS",
  REIMBURSEMENT = "REIMBURSEMENT",
  ALLOWANCE = "ALLOWANCE",
  LOAN_REPAYMENT = "LOAN_REPAYMENT",
  ADVANCE_RECOVERY = "ADVANCE_RECOVERY",
  PENALTY = "PENALTY",
  NOTICE_PAY = "NOTICE_PAY",
  CUSTOM = "CUSTOM",
}

export enum AdjustmentFrequency {
  ONE_TIME = "ONE_TIME",
  RECURRING = "RECURRING",
}

export enum AdjustmentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PROCESSED = "PROCESSED",
  CANCELLED = "CANCELLED",
}

export interface PayrollAdjustmentDocument extends BaseDocument {
  employeeId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  payrollRunId?: mongoose.Types.ObjectId;

  type: AdjustmentType;
  category: AdjustmentCategory;
  customLabel: string;
  amount: number;

  month: number;
  year: number;
  frequency: AdjustmentFrequency;

  // Recurring settings (optional)
  recurringStartMonth?: number;
  recurringStartYear?: number;
  recurringEndMonth?: number;
  recurringEndYear?: number;

  isTaxable: boolean;
  affectsPfWages: boolean;
  affectsEsiWages: boolean;

  status: AdjustmentStatus;
  notes?: string;
  rejectionReason?: string;

  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
}

const PayrollAdjustmentSchema = createBaseSchema<PayrollAdjustmentDocument>(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AdjustmentType),
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(AdjustmentCategory),
      required: true,
    },
    customLabel: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2100,
    },
    frequency: {
      type: String,
      enum: Object.values(AdjustmentFrequency),
      default: AdjustmentFrequency.ONE_TIME,
    },
    recurringStartMonth: { type: Number, min: 1, max: 12 },
    recurringStartYear: { type: Number, min: 2020, max: 2100 },
    recurringEndMonth: { type: Number, min: 1, max: 12 },
    recurringEndYear: { type: Number, min: 2020, max: 2100 },

    isTaxable: {
      type: Boolean,
      default: true,
    },
    affectsPfWages: {
      type: Boolean,
      default: false,
    },
    affectsEsiWages: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(AdjustmentStatus),
      default: AdjustmentStatus.PENDING,
      index: true,
    },
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },

    approvedBy: { type: mongoose.Schema.Types.ObjectId },
    approvedAt: { type: Date },
  },
  { collection: "payroll_adjustments" }
);

PayrollAdjustmentSchema.index({ tenantId: 1, employeeId: 1, year: 1, month: 1, status: 1 });
PayrollAdjustmentSchema.index({ tenantId: 1, status: 1 });

export const PayrollAdjustmentModel = mongoose.model<PayrollAdjustmentDocument>(
  "PayrollAdjustment",
  PayrollAdjustmentSchema
);
