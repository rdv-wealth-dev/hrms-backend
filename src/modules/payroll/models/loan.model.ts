import mongoose, { Schema } from "mongoose";
import { OrgLevelDocument, createOrgLevelSchema } from "../../../shared/database/base.schema";

export enum LoanType {
  SALARY_ADVANCE = "SALARY_ADVANCE",
  PERSONAL_LOAN = "PERSONAL_LOAN",
  EMERGENCY_LOAN = "EMERGENCY_LOAN",
  FESTIVAL_ADVANCE = "FESTIVAL_ADVANCE",
  EDUCATION_LOAN = "EDUCATION_LOAN",
  EQUIPMENT_PURCHASE = "EQUIPMENT_PURCHASE",
  OTHER = "OTHER",
}

export enum LoanStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum DisbursementMethod {
  PAYROLL_ADDITION = "PAYROLL_ADDITION",
  BANK_TRANSFER = "BANK_TRANSFER",
  CHEQUE = "CHEQUE",
  CASH = "CASH",
}

export interface LoanRepaymentRecord {
  year: number;
  month: number;
  payrollRunId?: mongoose.Types.ObjectId;
  payslipId?: mongoose.Types.ObjectId;
  amountPaid: number;
  principalComponent: number;
  interestComponent: number;
  balanceAfter: number;
  paidAt: Date;
}

export interface LoanDocument extends OrgLevelDocument {
  employeeId: mongoose.Types.ObjectId;
  loanType: LoanType;
  loanReferenceNo: string;
  principalAmount: number;
  interestRateAnnualPercent: number;
  tenureMonths: number;
  monthlyEmi: number;
  totalRepayableAmount: number;
  totalPaidAmount: number;
  remainingBalance: number;
  disbursementMethod: DisbursementMethod;
  disbursementDate?: Date;
  repaymentStartYear: number;
  repaymentStartMonth: number;
  status: LoanStatus;
  reason?: string;
  approverNotes?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  repaymentHistory: LoanRepaymentRecord[];
}

const LoanRepaymentSchema = new Schema<LoanRepaymentRecord>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: "PayrollRun" },
    payslipId: { type: Schema.Types.ObjectId, ref: "Payslip" },
    amountPaid: { type: Number, required: true, min: 0 },
    principalComponent: { type: Number, required: true, min: 0 },
    interestComponent: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LoanSchema = createOrgLevelSchema<LoanDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    loanType: {
      type: String,
      enum: Object.values(LoanType),
      default: LoanType.SALARY_ADVANCE,
      required: true,
    },
    loanReferenceNo: {
      type: String,
      required: true,
      trim: true,
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    interestRateAnnualPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tenureMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },
    monthlyEmi: {
      type: Number,
      required: true,
      min: 1,
    },
    totalRepayableAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    disbursementMethod: {
      type: String,
      enum: Object.values(DisbursementMethod),
      default: DisbursementMethod.BANK_TRANSFER,
    },
    disbursementDate: {
      type: Date,
    },
    repaymentStartYear: {
      type: Number,
      required: true,
    },
    repaymentStartMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    status: {
      type: String,
      enum: Object.values(LoanStatus),
      default: LoanStatus.PENDING,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    approverNotes: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: {
      type: Date,
    },
    repaymentHistory: {
      type: [LoanRepaymentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

LoanSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
LoanSchema.index({ tenantId: 1, loanReferenceNo: 1 }, { unique: true });
LoanSchema.index({ tenantId: 1, repaymentStartYear: 1, repaymentStartMonth: 1 });

export const LoanModel = mongoose.model<LoanDocument>("Loan", LoanSchema);
