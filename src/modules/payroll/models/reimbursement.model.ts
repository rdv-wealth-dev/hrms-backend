import mongoose, { Schema, Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export enum ReimbursementCategory {
  TRAVEL = "TRAVEL",
  FUEL = "FUEL",
  FOOD = "FOOD",
  INTERNET = "INTERNET",
  TELEPHONE = "TELEPHONE",
  MEDICAL = "MEDICAL",
  BOOKS_PERIODICALS = "BOOKS_PERIODICALS",
  RELOCATION = "RELOCATION",
  CLIENT_ENTERTAINMENT = "CLIENT_ENTERTAINMENT",
  OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
  GENERAL = "GENERAL",
}

export enum ReimbursementStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export interface IReimbursement extends OrgLevelDocument {
  employeeId: mongoose.Types.ObjectId;
  claimNumber: string;
  category: ReimbursementCategory;
  title: string;
  description?: string;
  amount: number;
  approvedAmount?: number;
  expenseDate: Date;
  receiptUrl?: string;
  receiptFileName?: string;
  status: ReimbursementStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  payrollRunId?: mongoose.Types.ObjectId;
  paidMonth?: string; // Format: "YYYY-MM"
  remarks?: string;
}

const reimbursementSchema = createOrgLevelSchema<IReimbursement>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    claimNumber: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ReimbursementCategory),
      default: ReimbursementCategory.GENERAL,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    receiptUrl: {
      type: String,
      trim: true,
    },
    receiptFileName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ReimbursementStatus),
      default: ReimbursementStatus.PENDING,
      index: true,
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
    payrollRunId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollRun",
      index: true,
    },
    paidMonth: {
      type: String,
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    collection: "payroll_reimbursements",
    timestamps: true,
  }
);

reimbursementSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
reimbursementSchema.index({ tenantId: 1, claimNumber: 1 }, { unique: true });

export const ReimbursementModel = mongoose.model<IReimbursement>(
  "Reimbursement",
  reimbursementSchema
);
