import { RequestContext } from "../../../shared/types/request-context.interface";
import { PayrollCalendarPolicyRepository } from "../repositories/payroll-calendar-policy.repository";
import {
  PayrollCalendarPolicyDocument,
  PayrollCycleType,
  AttendanceCutoffType,
  PayrollProcessingType,
  SalaryDisbursementType,
  LOPCalculationBase,
} from "../models/payroll-calendar-policy.model";
import { UpsertPayrollCalendarPolicyInput } from "../dto/payroll-calendar-policy.dto";

export interface CycleDatesResult {
  year: number;
  month: number;
  period: string; // "YYYY-MM"
  cycleType: PayrollCycleType;
  cycleStartDate: Date;
  cycleEndDate: Date;
  attendanceCutoffDate: Date;
  payrollProcessingDate: Date;
  salaryDisbursementDate: Date;
  totalDaysInPeriod: number;
  lopBase: LOPCalculationBase;
  lopDivisor: number;
  slaConfig: {
    hrHours: number;
    financeHours: number;
    autoEscalate: boolean;
  };
  reminders: {
    type: "CUTOFF_REMINDER" | "DISBURSEMENT_REMINDER";
    scheduledFor: Date;
    description: string;
  }[];
}

export class PayrollCalendarPolicyService {
  private repo = new PayrollCalendarPolicyRepository();

  /**
   * Returns the system default policy object (used for fallback when no policy is configured).
   */
  getDefaultPolicy(): Partial<PayrollCalendarPolicyDocument> {
    return {
      payrollCycleType: PayrollCycleType.CALENDAR_MONTH,
      customCycleStartDay: 1,
      attendanceCutoffType: AttendanceCutoffType.LAST_DAY_OF_MONTH,
      attendanceCutoffValue: 30,
      autoLockAttendance: false,
      payrollProcessingType: PayrollProcessingType.FIXED_DATE,
      payrollProcessingValue: 1,
      salaryDisbursementType: SalaryDisbursementType.FIXED_DATE,
      salaryDisbursementValue: 1,
      approvalSlaHrHours: 24,
      approvalSlaFinanceHours: 48,
      autoEscalateOnSlaBreach: false,
      lopCalculationBase: LOPCalculationBase.CALENDAR_DAYS,
      remindersEnabled: true,
      reminderLeadDays: 3,
    };
  }

  /**
   * Get policy for the current tenant, falling back gracefully to default policy.
   */
  async getPolicy(context: RequestContext): Promise<Partial<PayrollCalendarPolicyDocument>> {
    const policy = await this.repo.findByTenant(context);
    if (!policy) {
      return this.getDefaultPolicy();
    }
    return policy;
  }

  /**
   * Get raw saved policy or null if not yet created.
   */
  async getRawPolicy(context: RequestContext): Promise<PayrollCalendarPolicyDocument | null> {
    return this.repo.findByTenant(context);
  }

  /**
   * Upsert payroll calendar policy for tenant.
   */
  async upsertPolicy(
    context: RequestContext,
    input: UpsertPayrollCalendarPolicyInput
  ): Promise<PayrollCalendarPolicyDocument> {
    return this.repo.upsertPolicy(context, input as any);
  }

  /**
   * Resolves the effective Loss of Pay (LOP) divisor number based on policy.
   */
  getEffectiveLOPDivisor(
    policy: Partial<PayrollCalendarPolicyDocument> | null | undefined,
    year: number,
    month: number,
    workingDaysInMonth?: number
  ): number {
    const activeBase = policy?.lopCalculationBase || LOPCalculationBase.CALENDAR_DAYS;
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    switch (activeBase) {
      case LOPCalculationBase.FIXED_26:
        return 26;
      case LOPCalculationBase.ACTUAL_WORKING_DAYS:
        return workingDaysInMonth && workingDaysInMonth > 0 ? workingDaysInMonth : totalDaysInMonth;
      case LOPCalculationBase.CALENDAR_DAYS:
      default:
        return totalDaysInMonth;
    }
  }

  /**
   * Computes precise calendar cycle dates, SLAs, and cutoffs for a target year & month.
   */
  calculateCycleDates(
    policyInput: Partial<PayrollCalendarPolicyDocument> | null | undefined,
    year: number,
    month: number
  ): CycleDatesResult {
    const policy = { ...this.getDefaultPolicy(), ...(policyInput || {}) };
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    let cycleStartDate: Date;
    let cycleEndDate: Date;

    // 1. Determine Cycle Date Range
    if (policy.payrollCycleType === PayrollCycleType.CUSTOM_RANGE) {
      const startDay = policy.customCycleStartDay || 26;
      // Start date: startDay of previous month (e.g. 26th July for August payroll)
      cycleStartDate = new Date(year, month - 2, startDay, 0, 0, 0, 0);
      // End date: (startDay - 1) of current month (e.g. 25th August)
      cycleEndDate = new Date(year, month - 1, startDay - 1, 23, 59, 59, 999);
    } else {
      // CALENDAR_MONTH or BIWEEKLY fallback: 1st of month to last day of month
      cycleStartDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      cycleEndDate = new Date(year, month, 0, 23, 59, 59, 999);
    }

    const startNorm = new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth(), cycleStartDate.getDate()).getTime();
    const endNorm = new Date(cycleEndDate.getFullYear(), cycleEndDate.getMonth(), cycleEndDate.getDate()).getTime();
    const totalDaysInPeriod = Math.round((endNorm - startNorm) / (1000 * 60 * 60 * 24)) + 1;

    // 2. Attendance Cutoff Date
    let attendanceCutoffDate: Date;
    switch (policy.attendanceCutoffType) {
      case AttendanceCutoffType.FIXED_DATE: {
        const val = Math.min(policy.attendanceCutoffValue || 25, totalDaysInMonth);
        attendanceCutoffDate = new Date(year, month - 1, val, 23, 59, 59, 999);
        break;
      }
      case AttendanceCutoffType.DAYS_BEFORE_END: {
        const daysBefore = policy.attendanceCutoffValue || 5;
        attendanceCutoffDate = new Date(cycleEndDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        break;
      }
      case AttendanceCutoffType.MANUAL:
      case AttendanceCutoffType.LAST_DAY_OF_MONTH:
      default:
        attendanceCutoffDate = new Date(cycleEndDate);
        break;
    }

    // 3. Payroll Processing Date
    let payrollProcessingDate: Date;
    switch (policy.payrollProcessingType) {
      case PayrollProcessingType.DAYS_AFTER_CUTOFF: {
        const daysAfter = policy.payrollProcessingValue || 2;
        payrollProcessingDate = new Date(attendanceCutoffDate.getTime() + daysAfter * 24 * 60 * 60 * 1000);
        break;
      }
      case PayrollProcessingType.FIXED_DATE:
      case PayrollProcessingType.MANUAL:
      default: {
        const procDay = policy.payrollProcessingValue || 1;
        // If FIXED_DATE <= 15, assume 1st-15th of NEXT month; otherwise current month
        if (procDay <= 15) {
          payrollProcessingDate = new Date(year, month, procDay, 9, 0, 0, 0);
        } else {
          payrollProcessingDate = new Date(year, month - 1, Math.min(procDay, totalDaysInMonth), 9, 0, 0, 0);
        }
        break;
      }
    }

    // 4. Salary Disbursement Date
    let salaryDisbursementDate: Date;
    switch (policy.salaryDisbursementType) {
      case SalaryDisbursementType.DAYS_AFTER_APPROVAL: {
        const daysAfter = policy.salaryDisbursementValue || 2;
        salaryDisbursementDate = new Date(payrollProcessingDate.getTime() + daysAfter * 24 * 60 * 60 * 1000);
        break;
      }
      case SalaryDisbursementType.LAST_WORKING_DAY: {
        // Last day of month adjusted for weekend
        const lastDay = new Date(year, month, 0);
        if (lastDay.getDay() === 0) { // Sunday -> Friday
          lastDay.setDate(lastDay.getDate() - 2);
        } else if (lastDay.getDay() === 6) { // Saturday -> Friday
          lastDay.setDate(lastDay.getDate() - 1);
        }
        salaryDisbursementDate = lastDay;
        break;
      }
      case SalaryDisbursementType.FIXED_DATE:
      default: {
        const disbDay = policy.salaryDisbursementValue || 1;
        // Usually 1st or 2nd of NEXT month (e.g. 1st September for August)
        if (disbDay <= 15) {
          salaryDisbursementDate = new Date(year, month, disbDay, 10, 0, 0, 0);
        } else {
          salaryDisbursementDate = new Date(year, month - 1, Math.min(disbDay, totalDaysInMonth), 10, 0, 0, 0);
        }
        break;
      }
    }

    // 5. Reminders
    const reminders: CycleDatesResult["reminders"] = [];
    if (policy.remindersEnabled) {
      const leadMs = (policy.reminderLeadDays || 3) * 24 * 60 * 60 * 1000;
      const cutoffReminder = new Date(attendanceCutoffDate.getTime() - leadMs);
      const disbReminder = new Date(salaryDisbursementDate.getTime() - leadMs);

      reminders.push({
        type: "CUTOFF_REMINDER",
        scheduledFor: cutoffReminder,
        description: `Reminder: Attendance cutoff for period ${period} is approaching on ${attendanceCutoffDate.toLocaleDateString()}.`,
      });

      reminders.push({
        type: "DISBURSEMENT_REMINDER",
        scheduledFor: disbReminder,
        description: `Reminder: Salary disbursement for period ${period} is scheduled for ${salaryDisbursementDate.toLocaleDateString()}.`,
      });
    }

    const lopDivisor = this.getEffectiveLOPDivisor(policy, year, month);

    return {
      year,
      month,
      period,
      cycleType: policy.payrollCycleType as PayrollCycleType,
      cycleStartDate,
      cycleEndDate,
      attendanceCutoffDate,
      payrollProcessingDate,
      salaryDisbursementDate,
      totalDaysInPeriod,
      lopBase: policy.lopCalculationBase as LOPCalculationBase,
      lopDivisor,
      slaConfig: {
        hrHours: policy.approvalSlaHrHours || 24,
        financeHours: policy.approvalSlaFinanceHours || 48,
        autoEscalate: !!policy.autoEscalateOnSlaBreach,
      },
      reminders,
    };
  }
}
