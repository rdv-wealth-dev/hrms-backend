import { AttendanceStatus, AttendanceSession, SessionType } from "./models/attendance.model";
import { ShiftDocument } from "./models/shift.model";

// Distance between two lat/lng points in meters — Vincenty formula (WGS-84).
// Uses the WGS-84 ellipsoid (same model as GPS satellites), giving ~0.5mm
// accuracy vs Haversine's ~0.3% sphere approximation. Falls back to Haversine
// if Vincenty fails to converge (only happens for near-antipodal points).
// Used to validate mobile check-in against a branch's geofence.

export function distanceInMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    // WGS-84 ellipsoid constants
    const a  = 6378137.0;              // semi-major axis (equatorial radius), meters
    const f  = 1 / 298.257223563;      // flattening
    const b  = (1 - f) * a;            // semi-minor axis (polar radius), meters

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const φ1 = toRad(lat1), λ1 = toRad(lng1);
    const φ2 = toRad(lat2), λ2 = toRad(lng2);

    const U1 = Math.atan((1 - f) * Math.tan(φ1));  // reduced latitude
    const U2 = Math.atan((1 - f) * Math.tan(φ2));

    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    const L = λ2 - λ1;                 // difference in longitude
    let λ  = L;                        // iterative variable, starts at L

    let sinλ: number, cosλ: number;
    let sinσ: number, cosσ: number, σ: number;
    let sinα: number, cos2α: number;
    let cos2σm: number;
    let λPrev: number;
    let iterations = 0;

    // Iterate until convergence (typically 3–5 iterations)
    do {
        sinλ = Math.sin(λ);
        cosλ = Math.cos(λ);

        const t1 = cosU2 * sinλ;
        const t2 = cosU1 * sinU2 - sinU1 * cosU2 * cosλ;

        sinσ = Math.sqrt(t1 * t1 + t2 * t2);
        cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;

        σ = Math.atan2(sinσ, cosσ);

        sinα   = sinσ === 0 ? 0 : (cosU1 * cosU2 * sinλ) / sinσ;
        cos2α  = 1 - sinα * sinα;

        cos2σm = cos2α === 0 ? 0 : cosσ - (2 * sinU1 * sinU2) / cos2α;

        const C = (f / 16) * cos2α * (4 + f * (4 - 3 * cos2α));

        λPrev = λ;
        λ = L + (1 - C) * f * sinα *
            (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)));

        iterations++;
    } while (Math.abs(λ - λPrev) > 1e-12 && iterations < 200);

    // Failed to converge (antipodal edge case) — fall back to Haversine
    if (iterations >= 200) {
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    const u2  = cos2α * ((a * a - b * b) / (b * b));
    const A_v = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
    const B_v = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));

    const Δσ = B_v * sinσ * (
        cos2σm +
        (B_v / 4) * (
            cosσ * (-1 + 2 * cos2σm * cos2σm) -
            (B_v / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)
        )
    );

    return b * A_v * (σ - Δσ);   // distance in meters
}

// Validates a mobile punch against the branch's geofence config.
// Returns null (not applicable) if geofencing is disabled or branch has no
// coordinates set — never blocks a punch just because geofencing wasn't
// configured, only when it's explicitly enabled AND the point is outside.

export function checkGeofence(
  branchGeo: { lat?: number; lng?: number; geofenceRadiusMeters?: number; geofenceEnabled?: boolean } | undefined,
  punchLat?: number,
  punchLng?: number
): { withinGeofence: boolean | null; distanceMeters?: number } {

  if (!branchGeo?.geofenceEnabled) {
    return { withinGeofence: null };
  }

  if (branchGeo.lat == null || branchGeo.lng == null || punchLat == null || punchLng == null) {
    return { withinGeofence: null };
  }

  const distance = distanceInMeters(
    branchGeo.lat, branchGeo.lng,
    punchLat, punchLng
  );

  const radius = branchGeo.geofenceRadiusMeters ?? 100;

  return {
    withinGeofence: distance <= radius,
    distanceMeters: Math.round(distance),
  };
}

// Computes total worked minutes from a session array.
// Pairs CHECK_IN → BREAK_OUT (worked), BREAK_IN → CHECK_OUT (worked),
// and excludes break time entirely. Handles multiple break cycles.
// Sessions MUST be chronologically sorted before calling this.

export function calculateWorkedMinutes(sessions: AttendanceSession[]): number {
  if (sessions.length === 0) return 0;

  const sorted = [...sessions].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  let workedMs = 0;
  let workStart: Date | null = null;

  for (const session of sorted) {
    if (session.type === SessionType.CHECK_IN || session.type === SessionType.BREAK_IN) {
      // Start of a "working" interval
      workStart = session.timestamp;
    } else if (session.type === SessionType.BREAK_OUT || session.type === SessionType.CHECK_OUT) {
      // End of a "working" interval — accumulate if we had a matching start
      if (workStart) {
        workedMs += session.timestamp.getTime() - workStart.getTime();
        workStart = null;
      }
    }
  }

  return Math.max(0, Math.round(workedMs / 60000));
}

// Determines attendance status from check-in time + shift config + worked minutes.
// Industry-standard waterfall logic: arrival-based checks → duration-based checks → grace/late check.
// Returns both the AttendanceStatus and an optional halfDayType discriminator.

export function calculateAttendanceStatus(
  shift:         ShiftDocument,
  firstCheckIn:  Date | null,
  workedMinutes: number,
  graceUsed?:    number,
  graceLimit?:   number,
  lastCheckOut?: Date | null,
): { status: AttendanceStatus; halfDayType: "MORNING" | "AFTERNOON" | null } {

  const none = (status: AttendanceStatus) => ({ status, halfDayType: null as null });

  // ── 0. No punch at all ──────────────────────────────────────────────────────
  if (!firstCheckIn) {
    return none(AttendanceStatus.ABSENT);
  }

  // Build shift-start and shift-end Date objects anchored to the check-in day
  const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
  const shiftStart = new Date(firstCheckIn);
  shiftStart.setHours(shiftHour, shiftMin, 0, 0);

  const minutesLate = Math.max(0, (firstCheckIn.getTime() - shiftStart.getTime()) / 60000);

  // ── 1. Arrival-based ABSENT: arrived after absent threshold (e.g. 255 mins = ~2:15 PM) ────
  const absentThresholdMins = shift.absentThresholdMinutes ?? 255;
  if (minutesLate >= absentThresholdMins) {
    return none(AttendanceStatus.ABSENT);
  }

  // ── 2. First-half cutoff: arrived after firstHalfCutoffMinutes (e.g. 240 = 2:00 PM) ───────
  //    Any arrival beyond this cannot get 2nd-half credit — treat as ABSENT
  //    (They're arriving in the 2nd half and there's no remaining shift time to qualify)
  const firstHalfCutoffMins = shift.firstHalfCutoffMinutes ?? 240;
  if (minutesLate >= firstHalfCutoffMins) {
    return none(AttendanceStatus.ABSENT);
  }

  // ── 3. Minimum hours floor: worked below this → ABSENT regardless of anything else ─────────
  //    e.g. worked only 2 hrs — cannot credit even a half day
  const minWorkForHalfDay = shift.minimumWorkMinutesForHalfDay ?? 270;
  if (workedMinutes > 0 && workedMinutes < minWorkForHalfDay) {
    // Exception: only apply this if they actually checked out (not a mid-day single punch)
    if (lastCheckOut) {
      return none(AttendanceStatus.ABSENT);
    }
  }

  // ── 4. Arrival-based HALF_DAY_AFTERNOON: arrived past lateArrivalHalfDayMinutes ──────────
  //    Employee was absent in the first half, present in the second half.
  //    Condition: late arrival AND they worked enough hours (>= minimumWorkMinutesForHalfDay)
  const lateHalfDayMins = shift.lateArrivalHalfDayMinutes ?? 90;
  if (minutesLate >= lateHalfDayMins) {
    // They came too late for a full day — mark HALF_DAY_AFTERNOON (first half absent)
    return { status: AttendanceStatus.HALF_DAY_AFTERNOON, halfDayType: "AFTERNOON" };
  }

  // ── 5. Duration-based HALF_DAY_MORNING: worked below full-day threshold ────────────────────
  //    Employee arrived on time but left early — first half present, second half absent.
  const halfDayThreshMins = shift.halfDayThresholdMinutes ?? 240;
  if (workedMinutes < halfDayThreshMins && workedMinutes >= minWorkForHalfDay) {
    // Validate against secondHalfCutoffMinutes: did they work at least until 1:30 PM?
    const secondHalfCutoffMins = shift.secondHalfCutoffMinutes ?? 210;
    const elapsedFromShiftStart = lastCheckOut
      ? Math.max(0, (lastCheckOut.getTime() - shiftStart.getTime()) / 60000)
      : workedMinutes;

    if (elapsedFromShiftStart >= secondHalfCutoffMins) {
      // Checkout after 1:30 PM (secondHalfCutoff) — 1st half is credited, 2nd half absent
      return { status: AttendanceStatus.HALF_DAY_MORNING, halfDayType: "MORNING" };
    }
    // Checked out before secondHalfCutoff AND didn't work enough for full day → ABSENT
    return none(AttendanceStatus.ABSENT);
  }

  // ── 6. Duration below halfDayThreshold AND below minWorkForHalfDay → ABSENT ───────────────
  if (workedMinutes < halfDayThreshMins) {
    return none(AttendanceStatus.ABSENT);
  }

  // ── 7. Grace Period & Late-mark check (full-day duration met) ────────────────────────────
  const hasGraceLeft      = !graceLimit || (graceUsed ?? 0) < graceLimit;
  const effectiveGraceMin = hasGraceLeft ? (shift.gracePeriodMinutes ?? 15) : 0;

  if (minutesLate > effectiveGraceMin) {
    return none(AttendanceStatus.LATE);
  }

  // ── 8. Full Day PRESENT ───────────────────────────────────────────────────────────────────
  return none(AttendanceStatus.PRESENT);
}


// Normalizes any Date to midnight (00:00:00.000) — used so that
// "attendanceDate" is always a clean day boundary for the unique index
// { tenantId, employeeId, attendanceDate }.

export function normalizeToMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isCheckInLate(
  shift:         any,
  firstCheckIn:  Date | null,
  graceUsed?:    number,
  graceLimit?:   number
): boolean {
  if (!firstCheckIn) return false;
  const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
  const shiftStart = new Date(firstCheckIn);
  shiftStart.setHours(shiftHour, shiftMin, 0, 0);

  const hasGraceLeft = !graceLimit || (graceUsed ?? 0) < graceLimit;
  const effectiveGraceMinutes = hasGraceLeft ? shift.gracePeriodMinutes : 0;
  const lateThreshold = new Date(shiftStart.getTime() + effectiveGraceMinutes * 60000);

  return firstCheckIn > lateThreshold;
}

// Returns two flags:
//   isEarly             : checkout happened before shift endTime
//   isAllowedEarlyLeave : checkout was within the earlyLeaveStartTime→endTime window
//                         (no status penalty — tracked only for quota reporting)
//
// Zone diagram for shift 10:00–19:30, earlyLeaveStartTime=18:00:
//   before 18:00 → isEarly=true,  isAllowedEarlyLeave=false  (penalized)
//   18:00–19:29  → isEarly=true,  isAllowedEarlyLeave=true   (allowed, quota-tracked)
//   19:30+       → isEarly=false, isAllowedEarlyLeave=false  (full day)

export function checkIfCheckOutEarly(
  shift:          any,
  lastCheckOut:   Date | null,
  attendanceDate: Date
): { isEarly: boolean; isAllowedEarlyLeave: boolean } {
  if (!lastCheckOut) return { isEarly: false, isAllowedEarlyLeave: false };

  const [startHour, startMin] = shift.startTime.split(":").map(Number);
  const [endHour,   endMin  ] = shift.endTime.split(":").map(Number);

  // Build shift end anchored to attendanceDate
  const shiftEnd = new Date(attendanceDate);
  shiftEnd.setHours(endHour, endMin, 0, 0);
  // Handle overnight shifts (e.g. endTime < startTime)
  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  const isEarly = lastCheckOut < shiftEnd;
  if (!isEarly) return { isEarly: false, isAllowedEarlyLeave: false };

  // Determine if this early checkout is within the allowed early-leave window.
  // earlyLeaveStartTime defaults to endTime (no window) if not configured.
  const rawEarlyLeaveTime: string | undefined = shift.earlyLeaveStartTime;
  if (!rawEarlyLeaveTime) return { isEarly: true, isAllowedEarlyLeave: false };

  const [elHour, elMin] = rawEarlyLeaveTime.split(":").map(Number);
  const earlyLeaveStart = new Date(attendanceDate);
  earlyLeaveStart.setHours(elHour, elMin, 0, 0);
  // Handle overnight cross (same adjustment as shiftEnd)
  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
    earlyLeaveStart.setDate(earlyLeaveStart.getDate() + 1);
  }

  // isAllowedEarlyLeave = checkout >= earlyLeaveStart AND < shiftEnd
  const isAllowedEarlyLeave = lastCheckOut >= earlyLeaveStart;
  return { isEarly: true, isAllowedEarlyLeave };
}