import mongoose from "mongoose";
import { LeaveTypeDocument, LeaveAccrualFrequency } from "../sub-modules/leave-types/leave-type.model";
import { LeaveSessionType } from "../sub-modules/leave-requests/leave-request.model";
import { isWeeklyOffDay, CustomWeekOffRule } from "../../attendance/services/schedule-engine.service";


// Calculates total leave days between fromDate/toDate, accounting for
// half-day sessions at the start and/or end of the range.

export function calculateLeaveDays(
  fromDate: Date,
  toDate: Date,
  fromSession: LeaveSessionType,
  toSession: LeaveSessionType
): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  if (to < from) {
    throw new Error("toDate cannot be before fromDate");
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalCalendarDays = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;

  if (totalCalendarDays === 1) {
    if (fromSession === LeaveSessionType.FULL_DAY) return 1.0;
    return 0.5;
  }

  let days = totalCalendarDays;

  if (fromSession !== LeaveSessionType.FULL_DAY) days -= 0.5;
  if (toSession !== LeaveSessionType.FULL_DAY) days -= 0.5;

  return days;
}


// Computes accrued leave days for a given leave type as of a specific date.

export function calculateAccrualForPeriod(
  leaveType: LeaveTypeDocument,
  fromDate: Date,
  asOfDate: Date
): number {
  if (
    leaveType.accrualFrequency === LeaveAccrualFrequency.NONE ||
    leaveType.accrualFrequency === LeaveAccrualFrequency.ON_JOINING
  ) {
    return leaveType.annualQuota;
  }

  const start = new Date(fromDate);
  const asOf = new Date(asOfDate);

  if (asOf < start) return 0;

  const yearsDiff = asOf.getFullYear() - start.getFullYear();
  const monthsDiff = asOf.getMonth() - start.getMonth() + (yearsDiff * 12);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((asOf.getTime() - start.getTime()) / msPerDay);
  const weeksDiff = Math.floor(daysDiff / 7);

  let cyclesElapsed = 0;

  if (leaveType.accrualFrequency === LeaveAccrualFrequency.MONTHLY) {
    cyclesElapsed = monthsDiff + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.QUARTERLY) {
    cyclesElapsed = Math.floor(monthsDiff / 3) + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.HALF_YEARLY) {
    cyclesElapsed = Math.floor(monthsDiff / 6) + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.YEARLY) {
    cyclesElapsed = yearsDiff + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.WEEKLY) {
    cyclesElapsed = weeksDiff + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.BI_WEEKLY) {
    cyclesElapsed = Math.floor(weeksDiff / 2) + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.SEMI_MONTHLY) {
    cyclesElapsed = monthsDiff * 2 + (asOf.getDate() >= 15 ? 2 : 1) - (start.getDate() >= 15 ? 1 : 0);
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.DAILY) {
    cyclesElapsed = daysDiff + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.HOURLY) {
    cyclesElapsed = (daysDiff + 1) * 8; // Assumes 8 standard hours per day
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.MANUAL) {
    cyclesElapsed = 0;
  }

  const accrued = cyclesElapsed * leaveType.accrualAmountPerCycle;
  return Math.min(accrued, leaveType.annualQuota);
}


// Applies carry-forward cap from the previous year's leftover balance.

export function calculateCarryForward(
  leaveType: LeaveTypeDocument,
  previousYearAvailable: number
): number {
  if (previousYearAvailable <= 0) return 0;
  return Math.min(previousYearAvailable, leaveType.maxCarryForwardDays);
}

// Recomputes the `available` field from allocated/carriedForward/used/pending.
export function recalculateAvailable(balance: {
  allocated: number;
  carriedForward: number;
  used: number;
  pending: number;
}): number {
  return (balance.allocated + balance.carriedForward) - balance.used - balance.pending;
}

// Applies sandwich leave policy: if a leave request's date range has a holiday
// or a weekly-off day immediately touching (before the fromDate or after the
// toDate) with no working day gap, that holiday/weekoff also gets deducted.

export function applySandwichPolicy(
  baseDays: number,
  fromDate: Date,
  toDate: Date,
  weeklyOffDays: string[],
  holidayDates: Date[],
  customWeekOffRules?: CustomWeekOffRule[] | null
): { totalDays: number; isSandwiched: boolean } {

  const dayBefore = new Date(fromDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const dayAfter = new Date(toDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const isOffOrHoliday = (d: Date): boolean => {
    const isWeeklyOff = isWeeklyOffDay(d, weeklyOffDays, customWeekOffRules);
    const isHoliday = holidayDates.some(
      h => h.toDateString() === d.toDateString()
    );
    return isWeeklyOff || isHoliday;
  };

  let extraDays = 0;
  let sandwiched = false;

  if (isOffOrHoliday(dayBefore)) {
    extraDays += 1;
    sandwiched = true;
  }
  if (isOffOrHoliday(dayAfter)) {
    extraDays += 1;
    sandwiched = true;
  }

  return {
    totalDays: baseDays + extraDays,
    isSandwiched: sandwiched,
  };
}


export interface ApprovalChainOptions {
  approvalLevels: number;
  applicantRole?: string; // "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "ORG_ADMIN"
  managerUserId?: mongoose.Types.ObjectId;
  hrAdminUserId?: mongoose.Types.ObjectId;
  orgAdminUserId?: mongoose.Types.ObjectId;
  alternateAdminUserId?: mongoose.Types.ObjectId;
}

// Builds the approval chain for a leave request based on the applicant's
// position in the organization and the leave type's approvalLevels setting.
// Hierarchy:
// - Employee -> Direct Manager -> HR Admin -> Org Admin
// - Manager / Team Lead -> HR Admin -> Org Admin
// - HR Admin -> Org Admin -> Designated Authority
// - Org Admin -> Alternate Org Admin / Designated Authority

export function buildApprovalChain(
  optionsOrLevels: number | ApprovalChainOptions
): Array<{
  level: number;
  approverRole: string;
  approverId?: mongoose.Types.ObjectId;
  status: string;
}> {
  const opts: ApprovalChainOptions = typeof optionsOrLevels === "number"
    ? { approvalLevels: optionsOrLevels }
    : optionsOrLevels;

  const levels = Math.max(1, opts.approvalLevels || 1);
  const applicantRole = (opts.applicantRole || "EMPLOYEE").toUpperCase();

  // Define steps according to applicant's organizational position
  const rawSteps: Array<{ approverRole: string; approverId?: mongoose.Types.ObjectId }> = [];

  if (applicantRole === "ORG_ADMIN") {
    // Org Admin leave -> another designated authority / Org Admin
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.alternateAdminUserId,
    });
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.alternateAdminUserId,
    });
  } else if (applicantRole === "HR_ADMIN") {
    // HR Admin leave -> Org Admin -> designated authority
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.orgAdminUserId,
    });
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.alternateAdminUserId || opts.orgAdminUserId,
    });
  } else if (applicantRole === "MANAGER") {
    // Manager / Team Leader leave -> HR Admin -> Org Admin
    rawSteps.push({
      approverRole: "HR_ADMIN",
      approverId: opts.hrAdminUserId,
    });
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.orgAdminUserId,
    });
    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.alternateAdminUserId || opts.orgAdminUserId,
    });
  } else {
    // Standard Employee leave -> Direct Manager -> HR Admin -> Org Admin
    if (opts.managerUserId) {
      rawSteps.push({
        approverRole: "MANAGER",
        approverId: opts.managerUserId,
      });
    } else {
      // If no direct manager is configured for this employee, fallback to HR_ADMIN or MANAGER role
      rawSteps.push({
        approverRole: opts.hrAdminUserId ? "HR_ADMIN" : "MANAGER",
        approverId: opts.hrAdminUserId,
      });
    }

    rawSteps.push({
      approverRole: "HR_ADMIN",
      approverId: opts.hrAdminUserId,
    });

    rawSteps.push({
      approverRole: "ORG_ADMIN",
      approverId: opts.orgAdminUserId,
    });
  }

  const chain: Array<{
    level: number;
    approverRole: string;
    approverId?: mongoose.Types.ObjectId;
    status: string;
  }> = [];

  for (let i = 0; i < levels; i++) {
    const stepDef = rawSteps[i] || rawSteps[rawSteps.length - 1] || { approverRole: "ORG_ADMIN" };
    chain.push({
      level: i + 1,
      approverRole: stepDef.approverRole,
      approverId: stepDef.approverId,
      status: "PENDING",
    });
  }

  return chain;
}


// Resolves the effective annual quota for a leave type at a specific branch.

export function resolveEntitlementForBranch(
  leaveType: { annualQuota: number; branchOverrides: Array<{ branchId: any; annualQuota: number }> },
  branchId: string
): number {
  const override = leaveType.branchOverrides.find(
    (o) => o.branchId.toString() === branchId
  );
  return override ? override.annualQuota : leaveType.annualQuota;
}