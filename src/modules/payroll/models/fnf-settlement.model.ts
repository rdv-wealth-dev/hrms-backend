import mongoose, { Schema, Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export enum FnFStatus {
  DRAFT = "DRAFT",
  APPROVED = "APPROVED",
  PROCESSED = "PROCESSED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export enum LeavingReason {
  RESIGNED = "RESIGNED",
  TERMINATED = "TERMINATED",
  RETIRED = "RETIRED",
  CONTRACT_END = "CONTRACT_END",
  MUTUAL_SEPARATION = "MUTUAL_SEPARATION",
}

export interface IFnFSettlement extends OrgLevelDocument {
  employeeId: mongoose.Types.ObjectId;
  settlementNumber: string;
  resignationDate?: Date;
  lastWorkingDay: Date;
  leavingReason: LeavingReason;
  tenureYears: number;

  // Notice Period
  noticePeriodDays: number;
  noticeServedDays: number;
  shortfallNoticeDays: number;

  // Earnings
  lastDrawnGross: number;
  lastDrawnBasic: number;
  unpaidSalaryDays: number;
  unpaidSalaryAmount: number;
  leaveEncashmentDays: number;
  leaveEncashmentAmount: number;
  gratuityAmount: number;
  bonusAmount: number;
  reimbursementAmount: number;
  otherEarnings: number;
  totalEarnings: number;

  // Deductions
  noticeRecoveryAmount: number;
  loanBalanceRecovery: number;
  statutoryDeductions: number;
  assetDamageRecovery: number;
  otherDeductions: number;
  totalDeductions: number;

  // Payout
  netSettlement: number;
  status: FnFStatus;
  approvalNotes?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  paidAt?: Date;
}

const fnfSettlementSchema = createOrgLevelSchema<IFnFSettlement>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    settlementNumber: {
      type: String,
      required: true,
      index: true,
    },
    resignationDate: {
      type: Date,
    },
    lastWorkingDay: {
      type: Date,
      required: true,
      index: true,
    },
    leavingReason: {
      type: String,
      enum: Object.values(LeavingReason),
      default: LeavingReason.RESIGNED,
    },
    tenureYears: {
      type: Number,
      default: 0,
    },
    noticePeriodDays: {
      type: Number,
      default: 30,
    },
    noticeServedDays: {
      type: Number,
      default: 30,
    },
    shortfallNoticeDays: {
      type: Number,
      default: 0,
    },
    lastDrawnGross: {
      type: Number,
      required: true,
      default: 0,
    },
    lastDrawnBasic: {
      type: Number,
      required: true,
      default: 0,
    },
    unpaidSalaryDays: {
      type: Number,
      default: 0,
    },
    unpaidSalaryAmount: {
      type: Number,
      default: 0,
    },
    leaveEncashmentDays: {
      type: Number,
      default: 0,
    },
    leaveEncashmentAmount: {
      type: Number,
      default: 0,
    },
    gratuityAmount: {
      type: Number,
      default: 0,
    },
    bonusAmount: {
      type: Number,
      default: 0,
    },
    reimbursementAmount: {
      type: Number,
      default: 0,
    },
    otherEarnings: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    noticeRecoveryAmount: {
      type: Number,
      default: 0,
    },
    loanBalanceRecovery: {
      type: Number,
      default: 0,
    },
    statutoryDeductions: {
      type: Number,
      default: 0,
    },
    assetDamageRecovery: {
      type: Number,
      default: 0,
    },
    otherDeductions: {
      type: Number,
      default: 0,
    },
    totalDeductions: {
      type: Number,
      required: true,
      default: 0,
    },
    netSettlement: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(FnFStatus),
      default: FnFStatus.DRAFT,
      index: true,
    },
    approvalNotes: {
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
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    collection: "payroll_fnf_settlements",
    timestamps: true,
  }
);

fnfSettlementSchema.index({ tenantId: 1, settlementNumber: 1 }, { unique: true });
fnfSettlementSchema.index({ tenantId: 1, employeeId: 1 });

export const FnFSettlementModel = mongoose.model<IFnFSettlement>(
  "FnFSettlement",
  fnfSettlementSchema
);
