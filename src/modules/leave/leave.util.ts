import { LeaveTypeDocument, LeaveAccrualFrequency } from "./leave-type.model";
import { LeaveSessionType } from "./leave-request.model";

// Calculates total leave days between fromDate/toDate, accounting for
// half-day sessions at the start and/or end of the range.
//
// Examples:
//   Mon full day → Mon full day               = 1.0
//   Mon full day → Wed full day                = 3.0
//   Mon second-half → Mon second-half (same day, half day) = 0.5
//   Mon second-half → Wed first-half            = 2.0
//     (Mon 0.5 + Tue 1.0 + Wed 0.5)
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

  // Single day leave request
  if (totalCalendarDays === 1) {
    if (fromSession === LeaveSessionType.FULL_DAY) return 1.0;
    // Any half-day session on a single day = 0.5
    return 0.5;
  }

  // Multi-day request — start with full days for everything in between
  let days = totalCalendarDays;

  if (fromSession !== LeaveSessionType.FULL_DAY) days -= 0.5;
  if (toSession   !== LeaveSessionType.FULL_DAY) days -= 0.5;

  return days;
}


// Computes accrued leave days for a given leave type as of a specific date,
// based on the type's accrualFrequency and accrualAmountPerCycle.
//
// This does NOT persist anything — it's a pure calculation used by the
// service layer to decide how much to credit during a scheduled accrual run
// or when a new balance record is first created for an employee.

export function calculateAccrualForPeriod(
  leaveType:  LeaveTypeDocument,
  fromDate:   Date,
  asOfDate:   Date
): number {
  if (leaveType.accrualFrequency === LeaveAccrualFrequency.NONE) {
    // Fixed quota — full annualQuota granted upfront, no incremental accrual
    return leaveType.annualQuota;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceStart = Math.floor(
    (asOfDate.getTime() - fromDate.getTime()) / msPerDay
  );

  if (leaveType.accrualFrequency === LeaveAccrualFrequency.MONTHLY) {
    const monthsElapsed = Math.floor(daysSinceStart / 30) + 1; // include current month
    const accrued = monthsElapsed * leaveType.accrualAmountPerCycle;
    return Math.min(accrued, leaveType.annualQuota);
  }

  if (leaveType.accrualFrequency === LeaveAccrualFrequency.YEARLY) {
    return leaveType.annualQuota;
  }

  return 0;
}

// Applies carry-forward cap from the previous year's leftover balance.
// Returns the number of days that should actually carry over, respecting
// the leave type's maxCarryForwardDays limit.

export function calculateCarryForward(
  leaveType:       LeaveTypeDocument,
  previousYearAvailable: number
): number {
  if (previousYearAvailable <= 0) return 0;
  return Math.min(previousYearAvailable, leaveType.maxCarryForwardDays);
}


// Recomputes the `available` field from allocated/carriedForward/used/pending.
// Call this any time one of those four numbers changes, rather than setting
// `available` directly — keeps the derivation in one place.

export function recalculateAvailable(balance: {
  allocated:      number;
  carriedForward: number;
  used:           number;
  pending:        number;
}): number {
  return (balance.allocated + balance.carriedForward) - balance.used - balance.pending;
}