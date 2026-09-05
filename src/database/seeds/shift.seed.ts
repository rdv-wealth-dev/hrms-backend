import mongoose from "mongoose";

// ── Branch work-policy fields that customize the General Shift ──────────────
export interface BranchWorkPolicyOverride {
  shiftStartTime?: string;      // "09:00" — from workPolicy.shiftStartTime
  shiftEndTime?: string;        // "18:00" — from workPolicy.shiftEndTime
  workingHoursPerDay?: number;  // e.g. 9 — from workPolicy.workingHoursPerDay
}

interface ShiftSeed {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  graceLimitPerMonth: number;
  halfDayThresholdMinutes: number;
  fullDayMinutes: number;
  breakDurationMinutes: number;
  isDefault: boolean;
}

const DEFAULT_SHIFTS: ShiftSeed[] = [
  {
    name: "General Shift",
    code: "GEN",
    startTime: "09:00",   // overridden at seed time from branch workPolicy
    endTime: "18:00",     // overridden at seed time from branch workPolicy
    gracePeriodMinutes: 15,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: true,
  },
  {
    name: "Flexible Shift",
    code: "FLEX",
    startTime: "11:00",
    endTime: "20:00",
    gracePeriodMinutes: 15,
    graceLimitPerMonth: 5,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: false,
  },
  {
    name: "Morning Shift",
    code: "EARLY",
    startTime: "06:00",
    endTime: "15:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 30,
    isDefault: false,
  },
  {
    name: "Afternoon Shift",
    code: "LATE",
    startTime: "14:00",
    endTime: "23:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 45,
    isDefault: false,
  },
  {
    name: "Night Shift",
    code: "NIGHT",
    startTime: "22:00",
    endTime: "07:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: false,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "HH:MM" into total minutes since midnight. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Add `offset` minutes to an "HH:MM" string and return a new "HH:MM" string (wraps at 24h). */
function addMinutes(hhmm: string, offset: number): string {
  const total = (timeToMinutes(hhmm) + offset + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Compute effective working minutes between startTime and endTime.
 * Handles overnight shifts (e.g. 22:00 → 07:00).
 */
function computeShiftMinutes(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return e > s ? e - s : 1440 - s + e;
}

// ── Seed function ────────────────────────────────────────────────────────────

export async function seedShifts(
  tenantId: string,
  branchId: string,
  workPolicy?: BranchWorkPolicyOverride
): Promise<Map<string, string>> {
  const shiftMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const branchOId = new mongoose.Types.ObjectId(branchId);
  const now = new Date();

  const collection = mongoose.connection.collection("shifts");

  for (const shift of DEFAULT_SHIFTS) {
    let startTime = shift.startTime;
    let endTime   = shift.endTime;
    let fullDayMinutes = shift.fullDayMinutes;
    let halfDayThresholdMinutes = shift.halfDayThresholdMinutes;

    // ── Apply branch workPolicy overrides ONLY to the General Shift ──────────
    if (shift.code === "GEN" && workPolicy) {
      const policyStart = workPolicy.shiftStartTime;
      const policyEnd   = workPolicy.shiftEndTime;

      if (policyStart && /^([01]\d|2[0-3]):([0-5]\d)$/.test(policyStart)) {
        startTime = policyStart;
      }
      if (policyEnd && /^([01]\d|2[0-3]):([0-5]\d)$/.test(policyEnd)) {
        endTime = policyEnd;
      }

      // Derive fullDayMinutes:
      //   1. Use workingHoursPerDay if explicitly given.
      //   2. Otherwise compute from the resolved start/end times.
      if (workPolicy.workingHoursPerDay && workPolicy.workingHoursPerDay > 0) {
        fullDayMinutes = workPolicy.workingHoursPerDay * 60;
      } else if (policyStart || policyEnd) {
        // Subtract a standard 60-min break from raw shift duration
        const raw = computeShiftMinutes(startTime, endTime);
        fullDayMinutes = Math.max(raw - 60, raw); // keep raw if already accounting for break
      }

      halfDayThresholdMinutes = Math.round(fullDayMinutes / 2);
    }

    // ── Derive dependent timing windows from the final startTime / endTime ───
    const allowedCheckInFromTime = addMinutes(startTime, -60);  // 1 hr before shift start
    const checkInWindowStart     = addMinutes(startTime, -60);  // earliest punch accepted
    const checkInWindowEnd       = startTime;                   // deadline = shift start
    const earlyLeaveStartTime    = endTime;                     // no allowed early window by default

    const doc = {
      tenantId: tenantOId,
      branchId: branchOId,
      name: shift.name,
      code: shift.code,
      startTime,
      endTime,
      allowedCheckInFromTime,
      checkInWindowStart,
      checkInWindowEnd,
      earlyLeaveStartTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      graceLimitPerMonth: shift.graceLimitPerMonth,
      halfDayThresholdMinutes,
      fullDayMinutes,
      breakDurationMinutes: shift.breakDurationMinutes,
      isDefault: shift.isDefault,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await collection.insertOne(doc);
      shiftMap.set(shift.code, result.insertedId.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        // Shift already seeded — just collect the existing ID
        const existing = await collection.findOne({ tenantId: tenantOId, code: shift.code });
        if (existing) {
          shiftMap.set(shift.code, existing._id.toString());
        }
      }
    }
  }

  return shiftMap;
}
