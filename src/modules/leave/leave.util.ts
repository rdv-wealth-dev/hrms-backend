import { LeaveTypeDocument, LeaveAccrualFrequency } from "./leave-type.model";
import { LeaveSessionType } from "./leave-request.model";
import { isWeeklyOffDay, CustomWeekOffRule } from "../attendance/schedule-engine";


// Calculates total leave days between fromDate/toDate, accounting for
// half-day sessions at the start and/or end of the range.

export function calculateLeaveDays(
  fromDate:    Date,
  toDate:      Date,
  fromSession: LeaveSessionType,
  toSession:   LeaveSessionType
): number {
  const from = new Date(fromDate);
  const to   = new Date(toDate);
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
  if (toSession   !== LeaveSessionType.FULL_DAY) days -= 0.5;

  return days;
}


// Computes accrued leave days for a given leave type as of a specific date.

export function calculateAccrualForPeriod(
  leaveType: LeaveTypeDocument,
  fromDate:  Date,
  asOfDate:  Date
): number {
  if (leaveType.accrualFrequency === LeaveAccrualFrequency.NONE) {
    return leaveType.annualQuota;
  }

  const start = new Date(fromDate);
  const asOf  = new Date(asOfDate);

  if (asOf < start) return 0;

  const yearsDiff = asOf.getFullYear() - start.getFullYear();
  const monthsDiff = asOf.getMonth() - start.getMonth() + (yearsDiff * 12);

  let cyclesElapsed = 0;

  if (leaveType.accrualFrequency === LeaveAccrualFrequency.MONTHLY) {
    cyclesElapsed = monthsDiff + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.QUARTERLY) {
    cyclesElapsed = Math.floor(monthsDiff / 3) + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.HALF_YEARLY) {
    cyclesElapsed = Math.floor(monthsDiff / 6) + 1;
  } else if (leaveType.accrualFrequency === LeaveAccrualFrequency.YEARLY) {
    cyclesElapsed = yearsDiff + 1;
  }

  const accrued = cyclesElapsed * leaveType.accrualAmountPerCycle;
  return Math.min(accrued, leaveType.annualQuota);
}


// Applies carry-forward cap from the previous year's leftover balance.

export function calculateCarryForward(
  leaveType:             LeaveTypeDocument,
  previousYearAvailable: number
): number {
  if (previousYearAvailable <= 0) return 0;
  return Math.min(previousYearAvailable, leaveType.maxCarryForwardDays);
}

// Recomputes the `available` field from allocated/carriedForward/used/pending.
export function recalculateAvailable(balance: {
  allocated:      number;
  carriedForward: number;
  used:           number;
  pending:        number;
}): number {
  return (balance.allocated + balance.carriedForward) - balance.used - balance.pending;
}

// Applies sandwich leave policy: if a leave request's date range has a holiday
// or a weekly-off day immediately touching (before the fromDate or after the
// toDate) with no working day gap, that holiday/weekoff also gets deducted.

export function applySandwichPolicy(
  baseDays:      number,
  fromDate:      Date,
  toDate:        Date,
  weeklyOffDays: string[],
  holidayDates:  Date[],
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


// Builds the approval chain for a leave request based on the leave type's
// approvalLevels setting.

export function buildApprovalChain(approvalLevels: number): Array<{
  level: number;
  approverRole: string;
  status: string;
}> {
  const roleByLevel: Record<number, string> = {
    1: "HR_ADMIN",
    2: "ORG_ADMIN",
    3: "ORG_ADMIN",
  };

  const chain = [];
  for (let level = 1; level <= approvalLevels; level++) {
    chain.push({
      level,
      approverRole: roleByLevel[level],
      status: "PENDING",
    });
  }
  return chain;
}


// Resolves the effective annual quota for a leave type at a specific branch.

export function resolveEntitlementForBranch(
  leaveType: { annualQuota: number; branchOverrides: Array<{ branchId: any; annualQuota: number }> },
  branchId:  string
): number {
  const override = leaveType.branchOverrides.find(
    (o) => o.branchId.toString() === branchId
  );
  return override ? override.annualQuota : leaveType.annualQuota;
}