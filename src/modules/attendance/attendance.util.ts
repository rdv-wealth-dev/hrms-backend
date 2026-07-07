import { AttendanceStatus, AttendanceSession, SessionType } from "./attendance.model";
import { ShiftDocument } from "./shift.model";

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
// This is the core "automatic status" logic — no manual status setting needed
// for normal punches. Only regularization/manual entry overrides this.

export function calculateAttendanceStatus(
  shift:         ShiftDocument,
  firstCheckIn:  Date | null,
  workedMinutes: number,
  graceUsed?:    number,
  graceLimit?:   number
): AttendanceStatus {

  if (!firstCheckIn) {
    return AttendanceStatus.ABSENT;
  }

  if (workedMinutes < shift.halfDayThresholdMinutes) {
    return AttendanceStatus.HALF_DAY;
  }

  // If grace limit is set and exhausted, zero tolerance
  const hasGraceLeft = !graceLimit || (graceUsed ?? 0) < graceLimit;
  const effectiveGraceMinutes = hasGraceLeft ? shift.gracePeriodMinutes : 0;

  const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
  const shiftStart = new Date(firstCheckIn);
  shiftStart.setHours(shiftHour, shiftMin, 0, 0);

  const lateThreshold = new Date(shiftStart.getTime() + effectiveGraceMinutes * 60000);

  if (firstCheckIn > lateThreshold) {
    return AttendanceStatus.LATE;
  }

  return AttendanceStatus.PRESENT;
}

// Normalizes any Date to midnight (00:00:00.000) — used so that
// "attendanceDate" is always a clean day boundary for the unique index
// { tenantId, employeeId, attendanceDate }.

export function normalizeToMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}