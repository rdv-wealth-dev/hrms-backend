/**
 * schedule-engine.ts
 * 
 * Pure, side-effect-free calendar/schedule resolution engine.
 *
 * This is the SINGLE source of truth for:
 *   1. Whether a given day is WORKING / WEEK_OFF / HOLIDAY for a branch
 *   2. Which shift an employee is on for any given date (rotation-aware)
 *
 * Consumed by:
 *   • attendance-closeout.job.ts  — marks records WEEK_OFF or ABSENT correctly
 *   • calendar.controller.ts      — powers the dashboard month-view API
 *   • (future) payroll engine     — counts working days
 */

import { ShiftDocument } from "./shift.model";
import { ShiftRotationPlanDocument, RotationSlot, CycleDuration } from "./shift-rotation-plan.model";
import { HolidayDocument } from "../leave/holiday.model";

// ─── TYPES 

export enum SaturdayOffMode {
  ALL_OFF               = "ALL_OFF",
  ALL_WORKING           = "ALL_WORKING",
  FIRST_OFF             = "FIRST_OFF",
  SECOND_OFF            = "SECOND_OFF",
  THIRD_OFF             = "THIRD_OFF",
  FOURTH_OFF            = "FOURTH_OFF",
  FIFTH_OFF_IF_EXISTS   = "FIFTH_OFF_IF_EXISTS",
  FIRST_AND_THIRD_OFF   = "FIRST_AND_THIRD_OFF",
  SECOND_AND_FOURTH_OFF = "SECOND_AND_FOURTH_OFF",
  CUSTOM                = "CUSTOM",
}

export interface SaturdayPolicy {
  mode:            SaturdayOffMode;
  customOffWeeks?: number[]; // e.g. [1, 3] — used when mode === CUSTOM
}

export type DayType = "WORKING" | "WEEK_OFF" | "HOLIDAY";
export type OffReason =
  | "HOLIDAY"
  | "ROTATIONAL_OFF"
  | "FIXED_WEEKLY_OFF"
  | "SATURDAY_POLICY";

export interface CalendarDay {
  date:         string;      // "2026-07-04"
  dayOfWeek:    string;      // "Saturday"
  type:         DayType;
  holidayName?: string;
  weekNumber?:  number;      // 1–5, only populated for Saturdays
  offReason?:   OffReason;
}

export interface EmployeeDaySchedule {
  shift:       ShiftDocument | null;
  dayType:     DayType;
  offReason?:  OffReason;
  slotNumber?: number;       // 1-based active slot (if on a rotation plan)
}

// ─── SATURDAY HELPERS 

const DAY_NAMES_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/**
 * Returns which week-of-month occurrence a Saturday is (1st, 2nd, 3rd, 4th, 5th).
 * Works by counting how many Saturdays have already occurred in the month before it.
 */
export function getSaturdayWeekNumber(date: Date): number {
  const day = date.getDate();
  return Math.ceil(day / 7);
}

/**
 * Returns the total number of Saturdays in a given year/month.
 * Used to determine whether a 5th Saturday exists.
 */
export function countSaturdaysInMonth(year: number, month: number): number {
  // month is 1-based
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 6) count++;
  }
  return count;
}

/**
 * Determines if a Saturday date should be treated as a weekly off given the
 * branch's saturday policy.
 *
 * Returns true = day is OFF, false = day is WORKING.
 */
export function isSaturdayOff(
  date: Date,
  policy: SaturdayPolicy | undefined | null
): boolean {
  if (!policy || policy.mode === SaturdayOffMode.ALL_WORKING) return false;
  if (policy.mode === SaturdayOffMode.ALL_OFF) return true;

  const weekNum = getSaturdayWeekNumber(date);
  const totalSats = countSaturdaysInMonth(date.getFullYear(), date.getMonth() + 1);

  switch (policy.mode) {
    case SaturdayOffMode.FIRST_OFF:             return weekNum === 1;
    case SaturdayOffMode.SECOND_OFF:            return weekNum === 2;
    case SaturdayOffMode.THIRD_OFF:             return weekNum === 3;
    case SaturdayOffMode.FOURTH_OFF:            return weekNum === 4;
    case SaturdayOffMode.FIFTH_OFF_IF_EXISTS:   return totalSats >= 5 && weekNum === 5;
    case SaturdayOffMode.FIRST_AND_THIRD_OFF:   return weekNum === 1 || weekNum === 3;
    case SaturdayOffMode.SECOND_AND_FOURTH_OFF: return weekNum === 2 || weekNum === 4;
    case SaturdayOffMode.CUSTOM:
      return (policy.customOffWeeks ?? []).includes(weekNum);
    default:
      return false;
  }
}

// ─── ROTATION HELPERS 

const CYCLE_DAYS: Record<CycleDuration, number> = {
  [CycleDuration.WEEKLY]:   7,
  [CycleDuration.BIWEEKLY]: 14,
  [CycleDuration.MONTHLY]:  30,
};

/**
 * Given a rotation plan and the date when slot-1 started,
 * returns the active RotationSlot for the target date.
 *
 * Formula:
 *   daysSinceStart = floor((targetDate - rotationStart) / ms_per_day)
 *   totalCycleDays = cycleDurationDays * totalSlots
 *   posInCycle     = daysSinceStart % totalCycleDays
 *   activeSlotIdx  = floor(posInCycle / cycleDurationDays)
 */
export function getCurrentRotationSlot(
  plan:               ShiftRotationPlanDocument,
  rotationStartDate:  Date,
  targetDate:         Date
): RotationSlot {
  const MS_PER_DAY      = 86_400_000;
  const slotDays        = CYCLE_DAYS[plan.cycleDuration];
  const totalSlots      = plan.slots.length;
  const totalCycleDays  = slotDays * totalSlots;

  // Ensure start-of-day comparison
  const start  = new Date(rotationStartDate);
  start.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.max(
    0,
    Math.floor((target.getTime() - start.getTime()) / MS_PER_DAY)
  );

  const posInCycle   = daysSinceStart % totalCycleDays;
  const activeSlotIdx = Math.floor(posInCycle / slotDays);

  // Slots sorted by order; activeSlotIdx is 0-based
  const sorted = [...plan.slots].sort((a, b) => a.order - b.order);
  return sorted[activeSlotIdx] ?? sorted[0];
}

// ─── DAY OFF RESOLUTION 

/**
 * Resolves whether a given date is a working day or off for an employee,
 * using the following priority chain:
 *
 * 1. Holiday (org-wide or branch-specific) → always HOLIDAY (overrides everything)
 * 2. Rotation plan off-days                → WEEK_OFF (ROTATIONAL_OFF)
 * 3. Branch fixed weekly off days (Sunday) → WEEK_OFF (FIXED_WEEKLY_OFF)
 * 4. Branch Saturday policy                → WEEK_OFF (SATURDAY_POLICY) or WORKING
 */
export function resolveEmployeeDaySchedule(options: {
  targetDate:         Date;
  rotationPlan?:      ShiftRotationPlanDocument | null;
  rotationStartDate?: Date | null;
  fixedShift?:        ShiftDocument | null;
  fixedWeeklyOffDays: string[];     // from branch.workPolicy.weeklyOffDays
  saturdayPolicy?:    SaturdayPolicy | null;
  holidays:           HolidayDocument[];
  employeeBranchId?:  string;
}): EmployeeDaySchedule {
  const {
    targetDate,
    rotationPlan,
    rotationStartDate,
    fixedShift,
    fixedWeeklyOffDays,
    saturdayPolicy,
    holidays,
    employeeBranchId,
  } = options;

  const dayName = DAY_NAMES_FULL[targetDate.getDay()]; // "Saturday", "Sunday", etc.

  // ── 1. Holiday check 
  const isOrgWideHoliday = holidays.some((h) => !h.branchId);
  const isBranchHoliday  = employeeBranchId
    ? holidays.some((h) => h.branchId?.toString() === employeeBranchId)
    : false;

  if (isOrgWideHoliday || isBranchHoliday) {
    const holiday = holidays.find(
      (h) => !h.branchId || h.branchId?.toString() === employeeBranchId
    );
    return {
      shift:      resolveShift(rotationPlan, rotationStartDate, targetDate, fixedShift),
      dayType:    "HOLIDAY",
      offReason:  "HOLIDAY",
      slotNumber: rotationPlan ? getCurrentRotationSlot(rotationPlan, rotationStartDate!, targetDate).order : undefined,
    };
  }

  // ── 2. Rotation plan off days 
  if (rotationPlan && rotationStartDate) {
    const slot = getCurrentRotationSlot(rotationPlan, rotationStartDate, targetDate);
    if ((slot.offDays as string[]).includes(dayName)) {
      return {
        shift:      (slot as any).shiftId as ShiftDocument,
        dayType:    "WEEK_OFF",
        offReason:  "ROTATIONAL_OFF",
        slotNumber: slot.order,
      };
    }
    return {
      shift:      (slot as any).shiftId as ShiftDocument,
      dayType:    "WORKING",
      slotNumber: slot.order,
    };
  }

  // ── 3 & 4. Fixed shift path — check weekly off days + Saturday policy 

  // Fixed non-Saturday off days (typically Sunday)
  const nonSaturdayOffDays = fixedWeeklyOffDays.filter((d) => d !== "Saturday");
  if (nonSaturdayOffDays.includes(dayName)) {
    return { shift: fixedShift ?? null, dayType: "WEEK_OFF", offReason: "FIXED_WEEKLY_OFF" };
  }

  // Saturday policy
  if (dayName === "Saturday") {
    const hasActiveSatPolicy = !!(saturdayPolicy && saturdayPolicy.mode && Object.values(SaturdayOffMode).includes(saturdayPolicy.mode));
    if (hasActiveSatPolicy) {
      if (isSaturdayOff(targetDate, saturdayPolicy)) {
        return { shift: fixedShift ?? null, dayType: "WEEK_OFF", offReason: "SATURDAY_POLICY" };
      }
    } else {
      // Check if Saturday is explicitly in the fixed off-days list
      if (fixedWeeklyOffDays.includes("Saturday")) {
        return { shift: fixedShift ?? null, dayType: "WEEK_OFF", offReason: "FIXED_WEEKLY_OFF" };
      }
    }
  }

  return { shift: fixedShift ?? null, dayType: "WORKING" };
}

// Helper: resolve which shift applies for a given day
function resolveShift(
  rotationPlan?:      ShiftRotationPlanDocument | null,
  rotationStartDate?: Date | null,
  targetDate?:        Date,
  fixedShift?:        ShiftDocument | null,
): ShiftDocument | null {
  if (rotationPlan && rotationStartDate && targetDate) {
    const slot = getCurrentRotationSlot(rotationPlan, rotationStartDate, targetDate);
    return (slot as any).shiftId as ShiftDocument ?? fixedShift ?? null;
  }
  return fixedShift ?? null;
}

// ─── MONTH CALENDAR GENERATOR 

/**
 * Generates a full month calendar for a branch (not employee-specific).
 * Used by the dashboard GET /branches/:id/calendar endpoint.
 *
 * For Saturday cells, applies the branch's saturdayPolicy.
 * Merges in holidays.
 */
export function generateMonthCalendar(options: {
  year:            number;
  month:           number;  // 1-based
  fixedWeeklyOffDays: string[];
  saturdayPolicy?: SaturdayPolicy | null;
  holidays:        HolidayDocument[];
  branchId?:       string;
}): CalendarDay[] {
  const { year, month, fixedWeeklyOffDays, saturdayPolicy, holidays, branchId } = options;

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  const isOrgWideHoliday = (d: Date) => holidays.some((h) => !h.branchId && isSameDay(h.date, d));
  const isBranchHoliday  = (d: Date) =>
    branchId
      ? holidays.some((h) => h.branchId?.toString() === branchId && isSameDay(h.date, d))
      : false;

  const getHolidayName = (d: Date): string | undefined => {
    const h = holidays.find(
      (h) => isSameDay(h.date, d) && (!h.branchId || h.branchId?.toString() === branchId)
    );
    return h?.name;
  };

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date    = new Date(year, month - 1, dayNum);
    const dayName = DAY_NAMES_FULL[date.getDay()];
    const dateStr = formatDate(date);

    // Holiday?
    if (isOrgWideHoliday(date) || isBranchHoliday(date)) {
      days.push({
        date:        dateStr,
        dayOfWeek:   dayName,
        type:        "HOLIDAY",
        holidayName: getHolidayName(date),
        weekNumber:  dayName === "Saturday" ? getSaturdayWeekNumber(date) : undefined,
        offReason:   "HOLIDAY",
      });
      continue;
    }

    // Non-Saturday fixed off days
    const nonSaturdayOff = fixedWeeklyOffDays.filter((d) => d !== "Saturday");
    if (nonSaturdayOff.includes(dayName)) {
      days.push({
        date:      dateStr,
        dayOfWeek: dayName,
        type:      "WEEK_OFF",
        offReason: "FIXED_WEEKLY_OFF",
      });
      continue;
    }

    // Saturday logic
    if (dayName === "Saturday") {
      const weekNum = getSaturdayWeekNumber(date);
      const hasActiveSatPolicy = !!(saturdayPolicy && saturdayPolicy.mode && Object.values(SaturdayOffMode).includes(saturdayPolicy.mode));
      const isOff   = hasActiveSatPolicy
        ? isSaturdayOff(date, saturdayPolicy)
        : fixedWeeklyOffDays.includes("Saturday");

      days.push({
        date:      dateStr,
        dayOfWeek: dayName,
        type:      isOff ? "WEEK_OFF" : "WORKING",
        weekNumber: weekNum,
        offReason: isOff ? (hasActiveSatPolicy ? "SATURDAY_POLICY" : "FIXED_WEEKLY_OFF") : undefined,
      });
      continue;
    }

    days.push({ date: dateStr, dayOfWeek: dayName, type: "WORKING" });
  }

  return days;
}

// ─── UTILS 

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

export function formatDate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
