import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../core/database/base.schema";

export enum LeaveRequestStatus {
  PENDING   = "PENDING",    // awaiting current approval level
  APPROVED  = "APPROVED",   // all required levels signed off
  REJECTED  = "REJECTED",   // any level rejected — stops the chain
  CANCELLED = "CANCELLED",
}

export enum LeaveSessionType {
  FULL_DAY    = "FULL_DAY",
  FIRST_HALF  = "FIRST_HALF",
  SECOND_HALF = "SECOND_HALF",
}

export enum ApprovalLevelStatus {
  PENDING  = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SKIPPED  = "SKIPPED",   // e.g. optional Director level not required for this org
}

export interface ApprovalStep {
  level:       number;              // 1, 2, 3
  approverRole: string;             // "MANAGER", "HR_ADMIN", "SUPER_ADMIN" — who's expected to act
  approverId?: mongoose.Types.ObjectId;  // actual user who acted, once acted
  status:      ApprovalLevelStatus;
  comments?:   string;
  actedAt?:    Date;
}

export interface LeaveRequestDocument extends BaseDocument {
  employeeId:       mongoose.Types.ObjectId;
  leaveTypeId:      mongoose.Types.ObjectId;
  fromDate:         Date;
  toDate:           Date;
  fromSession:      LeaveSessionType;
  toSession:        LeaveSessionType;
  totalDays:        number;         // final days after sandwich policy applied
  baseDays:         number;         // days before sandwich policy applied
  isSandwiched:     boolean;
  reason:           string;
  status:           LeaveRequestStatus;
  currentApprovalLevel: number;     // which level is next to act
  approvals:        ApprovalStep[]; // full multi-level chain
  appliedAt:        Date;
  cancelledAt?:      Date;
  cancelReason?:    string;
  attachmentS3Key?: string;         // supporting document, e.g. medical certificate
}

const ApprovalStepSchema = new mongoose.Schema(
  {
    level:        { type: Number, required: true },
    approverRole: { type: String, required: true },
    approverId:   { type: mongoose.Schema.Types.ObjectId },
    status:       { type: String, enum: Object.values(ApprovalLevelStatus), default: ApprovalLevelStatus.PENDING },
    comments:     { type: String, trim: true },
    actedAt:      { type: Date },
  },
  { _id: false }
);

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
    baseDays: {
      type:     Number,
      required: true,
      min:      0.5,
    },
    isSandwiched: {
      type:    Boolean,
      default: false,
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
    currentApprovalLevel: {
      type:    Number,
      default: 1,
    },
    approvals: {
      type:    [ApprovalStepSchema],
      default: [],
    },
    appliedAt: {
      type:    Date,
      default: Date.now,
    },
    cancelledAt:      { type: Date },
    cancelReason:      { type: String, trim: true },
    attachmentS3Key:   { type: String, trim: true },
  },
  { collection: "leave_requests" }
);

LeaveRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
LeaveRequestSchema.index({ tenantId: 1, branchId: 1, status: 1 });
LeaveRequestSchema.index({ tenantId: 1, fromDate: 1, toDate: 1 });
LeaveRequestSchema.index({ tenantId: 1, status: 1, currentApprovalLevel: 1 });

export const LeaveRequestModel = mongoose.model<LeaveRequestDocument>(
  "LeaveRequest",
  LeaveRequestSchema
);