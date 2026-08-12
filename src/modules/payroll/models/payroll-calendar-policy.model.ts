import mongoose from "mongoose";
import {
  createOrgLevelSchema,
  OrgLevelDocument,
} from "../../../shared/database/base.schema";

export enum PayrollCycleType {
  CALENDAR_MONTH = "CALENDAR_MONTH",
  CUSTOM_RANGE = "CUSTOM_RANGE",
  BIWEEKLY = "BIWEEKLY",
}

export enum AttendanceCutoffType {
  LAST_DAY_OF_MONTH = "LAST_DAY_OF_MONTH",
  FIXED_DATE = "FIXED_DATE",
  DAYS_BEFORE_END = "DAYS_BEFORE_END",
  MANUAL = "MANUAL",
}

export enum PayrollProcessingType {
  FIXED_DATE = "FIXED_DATE",
  DAYS_AFTER_CUTOFF = "DAYS_AFTER_CUTOFF",
  MANUAL = "MANUAL",
}

export enum SalaryDisbursementType {
  FIXED_DATE = "FIXED_DATE",
  DAYS_AFTER_APPROVAL = "DAYS_AFTER_APPROVAL",
  LAST_WORKING_DAY = "LAST_WORKING_DAY",
}

export enum LOPCalculationBase {
  CALENDAR_DAYS = "CALENDAR_DAYS",
  FIXED_26 = "FIXED_26",
  ACTUAL_WORKING_DAYS = "ACTUAL_WORKING_DAYS",
}

export interface PayrollCalendarPolicyDocument extends OrgLevelDocument {
  payrollCycleType: PayrollCycleType;
  customCycleStartDay?: number; // 1-31, used when CUSTOM_RANGE (e.g. 26th of prev month)
  
  attendanceCutoffType: AttendanceCutoffType;
  attendanceCutoffValue?: number; // e.g. 25 if FIXED_DATE, or 5 if DAYS_BEFORE_END
  autoLockAttendance: boolean;
  
  payrollProcessingType: PayrollProcessingType;
  payrollProcessingValue?: number; // e.g. 28 if FIXED_DATE, or 2 if DAYS_AFTER_CUTOFF
  
  salaryDisbursementType: SalaryDisbursementType;
  salaryDisbursementValue?: number; // e.g. 1 if FIXED_DATE (1st of month), or 2 if DAYS_AFTER_APPROVAL
  
  approvalSlaHrHours: number;
  approvalSlaFinanceHours: number;
  autoEscalateOnSlaBreach: boolean;
  
  lopCalculationBase: LOPCalculationBase;
  
  remindersEnabled: boolean;
  reminderLeadDays: number;
}

const PayrollCalendarPolicySchema = createOrgLevelSchema<PayrollCalendarPolicyDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    payrollCycleType: {
      type: String,
      enum: Object.values(PayrollCycleType),
      default: PayrollCycleType.CALENDAR_MONTH,
    },
    customCycleStartDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 1,
    },
    attendanceCutoffType: {
      type: String,
      enum: Object.values(AttendanceCutoffType),
      default: AttendanceCutoffType.LAST_DAY_OF_MONTH,
    },
    attendanceCutoffValue: {
      type: Number,
      min: 1,
      max: 31,
      default: 30,
    },
    autoLockAttendance: {
      type: Boolean,
      default: false,
    },
    payrollProcessingType: {
      type: String,
      enum: Object.values(PayrollProcessingType),
      default: PayrollProcessingType.FIXED_DATE,
    },
    payrollProcessingValue: {
      type: Number,
      min: 1,
      max: 31,
      default: 1,
    },
    salaryDisbursementType: {
      type: String,
      enum: Object.values(SalaryDisbursementType),
      default: SalaryDisbursementType.FIXED_DATE,
    },
    salaryDisbursementValue: {
      type: Number,
      min: 1,
      max: 31,
      default: 1,
    },
    approvalSlaHrHours: {
      type: Number,
      min: 1,
      default: 24,
    },
    approvalSlaFinanceHours: {
      type: Number,
      min: 1,
      default: 48,
    },
    autoEscalateOnSlaBreach: {
      type: Boolean,
      default: false,
    },
    lopCalculationBase: {
      type: String,
      enum: Object.values(LOPCalculationBase),
      default: LOPCalculationBase.CALENDAR_DAYS,
    },
    remindersEnabled: {
      type: Boolean,
      default: true,
    },
    reminderLeadDays: {
      type: Number,
      min: 0,
      max: 30,
      default: 3,
    },
  },
  { timestamps: true }
);

export const PayrollCalendarPolicyModel =
  mongoose.models.PayrollCalendarPolicy ||
  mongoose.model<PayrollCalendarPolicyDocument>(
    "PayrollCalendarPolicy",
    PayrollCalendarPolicySchema
  );
