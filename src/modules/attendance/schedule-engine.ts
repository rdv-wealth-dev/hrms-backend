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

export interface CustomWeekOffRule {
  dayOfWeek: string; // "Sunday" | "Monday" | ... | "Saturday"
  weeks:     number[]; // 1–5; empty = all working, [1,2,3,4,5] = all off
}

export type DayType = "WORKING" | "WEEK_OFF" | "HOLIDAY";
export type OffReason =
  | "HOLIDAY"
  | "ROTATIONAL_OFF"
  | "FIXED_WEEKLY_OFF"
  | "CUSTOM_WEEK_OFF";

export interface CalendarDay {
  date:         string;      // "2026-07-04"
  dayOfWeek:    string;      // "Saturday"
  type:         DayType;
  holidayName?: string;
  weekNumber?:  number;      // 1–5, populated for Saturdays and custom off days
  offReason?:   OffReason;
}

export interface EmployeeDaySchedule {
  shift:       ShiftDocument | null;
  dayType:     DayType;
  offReason?:  OffReason;
  slotNumber?: number;       // 1-based active slot (if on a rotation plan)
}

// ─── HELPERS

const DAY_NAMES_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/** Returns the week-of-month occurrence index (1–5) for any date. */
function weekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/**
 * Returns true if `date` is a week-off day, using the priority chain:
 *  1. customWeekOffRules — if a rule exists for this weekday it fully controls the outcome
 *  2. fixedWeeklyOffDays — e.g. ["Sunday"]
 */
export function isWeeklyOffDay(
  date: Date,
  fixedWeeklyOffDays: string[],
  customWeekOffRules?: CustomWeekOffRule[] | null
): boolean {
  const dayName = DAY_NAMES_FULL[date.getDay()];

  if (customWeekOffRules?.length) {
    const rule = customWeekOffRules.find(
      r => r.dayOfWeek.toLowerCase() === dayName.toLowerCase()
    );
    if (rule) return rule.weeks.includes(weekOfMonth(date));
  }

  return fixedWeeklyOffDays.includes(dayName);
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
 * Resolves whether a given date is a working day or off for an employee.
 *
 * Priority chain:
 *  1. Holiday (org-wide or branch-specific) → HOLIDAY
 *  2. Rotation plan off-days                → WEEK_OFF (ROTATIONAL_OFF)
 *  3. customWeekOffRules / fixedWeeklyOffDays
 */
export function resolveEmployeeDaySchedule(options: {
  targetDate:          Date;
  rotationPlan?:       ShiftRotationPlanDocument | null;
  rotationStartDate?:  Date | null;
  fixedShift?:         ShiftDocument | null;
  fixedWeeklyOffDays:  string[];
  customWeekOffRules?: CustomWeekOffRule[] | null;
  holidays:            HolidayDocument[];
  employeeBranchId?:   string;
}): EmployeeDaySchedule {
  const {
    targetDate, rotationPlan, rotationStartDate,
    fixedShift, fixedWeeklyOffDays, customWeekOffRules,
    holidays, employeeBranchId,
  } = options;

  const dayName = DAY_NAMES_FULL[targetDate.getDay()];

  // 1. Holiday
  const isOrgWideHoliday = holidays.some(h => !h.branchId);
  const isBranchHoliday  = employeeBranchId
    ? holidays.some(h => h.branchId?.toString() === employeeBranchId)
    : false;

  if (isOrgWideHoliday || isBranchHoliday) {
    return {
      shift:      resolveShift(rotationPlan, rotationStartDate, targetDate, fixedShift),
      dayType:    "HOLIDAY",
      offReason:  "HOLIDAY",
      slotNumber: rotationPlan ? getCurrentRotationSlot(rotationPlan, rotationStartDate!, targetDate).order : undefined,
    };
  }

  // 2. Rotation plan
  if (rotationPlan && rotationStartDate) {
    const slot = getCurrentRotationSlot(rotationPlan, rotationStartDate, targetDate);
    if ((slot.offDays as string[]).includes(dayName)) {
      return { shift: (slot as any).shiftId as ShiftDocument, dayType: "WEEK_OFF", offReason: "ROTATIONAL_OFF", slotNumber: slot.order };
    }
    return { shift: (slot as any).shiftId as ShiftDocument, dayType: "WORKING", slotNumber: slot.order };
  }

  // 3. Custom rules / fixed days
  if (isWeeklyOffDay(targetDate, fixedWeeklyOffDays, customWeekOffRules)) {
    const hasCustomRule = customWeekOffRules?.some(
      r => r.dayOfWeek.toLowerCase() === dayName.toLowerCase()
    );
    return {
      shift:     fixedShift ?? null,
      dayType:   "WEEK_OFF",
      offReason: hasCustomRule ? "CUSTOM_WEEK_OFF" : "FIXED_WEEKLY_OFF",
    };
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
 * Used by GET /branches/:id/calendar. Merges holidays.
 */
export function generateMonthCalendar(options: {
  year:                number;
  month:               number; // 1-based
  fixedWeeklyOffDays:  string[];
  customWeekOffRules?: CustomWeekOffRule[] | null;
  holidays:            HolidayDocument[];
  branchId?:           string;
}): CalendarDay[] {
  const { year, month, fixedWeeklyOffDays, customWeekOffRules, holidays, branchId } = options;

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  const isOrgWideHoliday = (d: Date) => holidays.some(h => !h.branchId && isSameDay(h.date, d));
  const isBranchHoliday  = (d: Date) =>
    branchId ? holidays.some(h => h.branchId?.toString() === branchId && isSameDay(h.date, d)) : false;
  const getHolidayName   = (d: Date) =>
    holidays.find(h => isSameDay(h.date, d) && (!h.branchId || h.branchId?.toString() === branchId))?.name;

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date    = new Date(year, month - 1, dayNum);
    const dayName = DAY_NAMES_FULL[date.getDay()];
    const dateStr = formatDate(date);
    const wk      = weekOfMonth(date);

    if (isOrgWideHoliday(date) || isBranchHoliday(date)) {
      days.push({ date: dateStr, dayOfWeek: dayName, type: "HOLIDAY", holidayName: getHolidayName(date), weekNumber: wk, offReason: "HOLIDAY" });
      continue;
    }

    if (isWeeklyOffDay(date, fixedWeeklyOffDays, customWeekOffRules)) {
      const hasCustomRule = customWeekOffRules?.some(
        r => r.dayOfWeek.toLowerCase() === dayName.toLowerCase()
      );
      days.push({
        date: dateStr, dayOfWeek: dayName, type: "WEEK_OFF", weekNumber: wk,
        offReason: hasCustomRule ? "CUSTOM_WEEK_OFF" : "FIXED_WEEKLY_OFF",
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
