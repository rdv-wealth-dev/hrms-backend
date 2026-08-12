import { z } from "zod";
import {
  PayrollCycleType,
  AttendanceCutoffType,
  PayrollProcessingType,
  SalaryDisbursementType,
  LOPCalculationBase,
} from "../models/payroll-calendar-policy.model";

export const UpsertPayrollCalendarPolicyDto = z.object({
  payrollCycleType: z.nativeEnum(PayrollCycleType).optional().default(PayrollCycleType.CALENDAR_MONTH),
  customCycleStartDay: z.number().int().min(1).max(31).optional().default(1),
  
  attendanceCutoffType: z.nativeEnum(AttendanceCutoffType).optional().default(AttendanceCutoffType.LAST_DAY_OF_MONTH),
  attendanceCutoffValue: z.number().int().min(1).max(31).optional().default(30),
  autoLockAttendance: z.boolean().optional().default(false),
  
  payrollProcessingType: z.nativeEnum(PayrollProcessingType).optional().default(PayrollProcessingType.FIXED_DATE),
  payrollProcessingValue: z.number().int().min(1).max(31).optional().default(1),
  
  salaryDisbursementType: z.nativeEnum(SalaryDisbursementType).optional().default(SalaryDisbursementType.FIXED_DATE),
  salaryDisbursementValue: z.number().int().min(1).max(31).optional().default(1),
  
  approvalSlaHrHours: z.number().int().min(1).max(720).optional().default(24),
  approvalSlaFinanceHours: z.number().int().min(1).max(720).optional().default(48),
  autoEscalateOnSlaBreach: z.boolean().optional().default(false),
  
  lopCalculationBase: z.nativeEnum(LOPCalculationBase).optional().default(LOPCalculationBase.CALENDAR_DAYS),
  
  remindersEnabled: z.boolean().optional().default(true),
  reminderLeadDays: z.number().int().min(0).max(30).optional().default(3),
});

export type UpsertPayrollCalendarPolicyInput = z.infer<typeof UpsertPayrollCalendarPolicyDto>;

export const PreviewCalendarCycleDto = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type PreviewCalendarCycleInput = z.infer<typeof PreviewCalendarCycleDto>;
