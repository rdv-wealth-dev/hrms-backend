import mongoose from "mongoose";
import { createBaseSchema, BaseDocument, } from "../../core/database/base.schema";

export enum LeaveRequestStatus {
  PENDING   = "PENDING",
  APPROVED  = "APPROVED",
  REJECTED  = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum LeaveSessionType {
  FULL_DAY   = "FULL_DAY",
  FIRST_HALF = "FIRST_HALF",
  SECOND_HALF = "SECOND_HALF",
}

export interface LeaveRequestDocument extends BaseDocument {
  employeeId:      mongoose.Types.ObjectId;
  leaveTypeId:     mongoose.Types.ObjectId;
  fromDate:        Date;
  toDate:          Date;
  fromSession:      LeaveSessionType;   // handles half-day starts
  toSession:        LeaveSessionType;   // handles half-day ends
  totalDays:       number;              // computed, accounts for half-days
  reason:          string;
  status:          LeaveRequestStatus;
  appliedAt:       Date;
  reviewedBy?:     mongoose.Types.ObjectId;
  reviewedAt?:     Date;
  reviewComments?: string;
  cancelledAt?:    Date;
  cancelReason?:   string;
}

const LeaveRequestSchema = createBaseSchema<LeaveRequestDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    leaveTypeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    fromDate: {
      type:     Date,
      required: true,
    },
    toDate: {
      type:     Date,
      required: true,
    },
    fromSession: {
      type:    String,
      enum:    Object.values(LeaveSessionType),
      default: LeaveSessionType.FULL_DAY,
    },
    toSession: {
      type:    String,
      enum:    Object.values(LeaveSessionType),
      default: LeaveSessionType.FULL_DAY,
    },
    totalDays: {
      type:     Number,
      required: true,
      min:      0.5,
    },
    reason: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 500,
    },
    status: {
      type:    String,
      enum:    Object.values(LeaveRequestStatus),
      default: LeaveRequestStatus.PENDING,
    },
    appliedAt: {
      type:    Date,
      default: Date.now,
    },
    reviewedBy:     { type: mongoose.Schema.Types.ObjectId },
    reviewedAt:     { type: Date },
    reviewComments: { type: String, trim: true },
    cancelledAt:    { type: Date },
    cancelReason:   { type: String, trim: true },
  },
  { collection: "leave_requests" }
);

LeaveRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
LeaveRequestSchema.index({ tenantId: 1, branchId: 1, status: 1 });
LeaveRequestSchema.index({ tenantId: 1, fromDate: 1, toDate: 1 });
LeaveRequestSchema.index({ tenantId: 1, status: 1 });

export const LeaveRequestModel = mongoose.model<LeaveRequestDocument>(
  "LeaveRequest",
  LeaveRequestSchema
);