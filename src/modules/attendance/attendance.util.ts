import { AttendanceStatus, AttendanceSession, SessionType } from "./attendance.model";
import { ShiftDocument } from "./shift.model";

// Distance between two lat/lng points in meters — Haversine formula.
// Used to validate mobile check-in against a branch's geofence.

export function distanceInMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000      // earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = 
        Math.sin(dLat / 2) ** 2 + 
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

  const radius = branchGeo.geofenceRadiusMeters ?? 200;

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
  workedMinutes: number
): AttendanceStatus {

  if (!firstCheckIn) {
    return AttendanceStatus.ABSENT;
  }

  if (workedMinutes < shift.halfDayThresholdMinutes) {
    return AttendanceStatus.HALF_DAY;
  }

  // Parse shift start time "09:00" into today's Date for comparison
  const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
  const shiftStart = new Date(firstCheckIn);
  shiftStart.setHours(shiftHour, shiftMin, 0, 0);

  const graceMs = shift.gracePeriodMinutes * 60000;
  const lateThreshold = new Date(shiftStart.getTime() + graceMs);

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