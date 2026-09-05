import mongoose from "mongoose";
import { EmployeeModel } from "../../employee/models/employee.model";
import { AttendanceModel, AttendanceStatus, PunchSource, SessionType } from "../models/attendance.model";
import { HolidayModel } from "../../leave/sub-modules/holidays/holiday.model";
import { BranchModel } from "../../branch/branch.model";
import { OrganizationModel } from "../../organization/organization.model";
import { ShiftRotationPlanModel } from "../models/shift-rotation-plan.model";
import { ShiftRepository } from "../repositories/shift.repository";
import { normalizeToMidnight } from "../attendance.util";
import { resolveEmployeeDaySchedule, CustomWeekOffRule } from "../services/schedule-engine.service";
import { getRawLogModel } from "../../device/biometric.models";
import { logger } from "../../../config/logger.config";

const shiftRepo = new ShiftRepository();

export interface ReconcileResult {
  processed: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  weekOffCount: number;
  holidayCount: number;
}

/**
 * Reconcile all biometric punches and close out attendance for a given tenant and date.
 * 1. For employees with biometric punches: converts raw punches into Attendance sessions,
 *    computes worked hours, late flags, and status (PRESENT / HALF_DAY).
 * 2. For employees with NO biometric punches: resolves whether it is a HOLIDAY, WEEK_OFF, or marks them ABSENT.
 */
export async function reconcileAttendanceForDate(
  tenantId: string,
  date: Date
): Promise<ReconcileResult> {
  const targetDate = normalizeToMidnight(date);

  // Format date string as YYYY-MM-DD
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

  logger.info(`[AttendanceReconcile] Starting reconciliation for tenant=${tenantId}, date=${dateStr}`);

  // 1. Fetch organization locale & config
  const org = await OrganizationModel.findById(tenantId).lean();
  const orgWeeklyOffDays = org?.locale?.weeklyOffDays ?? ["Sunday"];
  const orgCustomWeekOffRules = (org?.locale as any)?.customWeekOffRules as CustomWeekOffRule[] | undefined;

  // 2. Fetch all active employees for this tenant
  const employees = await EmployeeModel.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    isDeleted: false,
  }).select("_id employeeCode branchId shiftId rotationPlanId rotationStartDate");

  if (!employees.length) {
    logger.info(`[AttendanceReconcile] No active employees found for tenant=${tenantId}`);
    return { processed: 0, presentCount: 0, halfDayCount: 0, absentCount: 0, weekOffCount: 0, holidayCount: 0 };
  }

  // 3. Fetch all raw biometric logs for this tenant and date
  const RawLogModel = getRawLogModel();
  const rawLogs = await RawLogModel.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    punchDate: dateStr,
  }).lean();

  // Group raw logs by employeeCode
  const logsByCode = new Map<string, Array<{ punchTime: string; receivedAt: Date }>>();
  for (const log of rawLogs) {
    if (!log.employeeID) continue;
    const code = log.employeeID.trim().toUpperCase();
    if (!logsByCode.has(code)) {
      logsByCode.set(code, []);
    }
    logsByCode.get(code)!.push({
      punchTime: log.punchTime || "00:00",
      receivedAt: log.receivedAt,
    });
  }

  // 4. Fetch holidays for this date
  const holidays = await HolidayModel.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    date: targetDate,
    isDeleted: false,
  }).select("branchId name");

  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let weekOffCount = 0;
  let holidayCount = 0;

  for (const emp of employees) {
    if (!emp.branchId) continue; // skip unassigned branch

    // Check if attendance record already manually created or approved
    const existing = await AttendanceModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: emp._id,
      attendanceDate: targetDate,
    });

    // If attendance already finalized with manual entry or regularization, leave intact
    if (existing && (existing.isRegularized || existing.sessions.some(s => s.source === PunchSource.MANUAL))) {
      continue;
    }

    // Branch config
    const branch = await BranchModel.findById(emp.branchId).select("workPolicy").lean();
    const branchWeeklyOffDays = branch?.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;
    const branchCustomWeekOffRules = (branch?.workPolicy as any)?.customWeekOffRules as CustomWeekOffRule[] | undefined
      ?? orgCustomWeekOffRules;

    // Shift resolution
    const rotationPlan = emp.rotationPlanId
      ? await ShiftRotationPlanModel.findById(emp.rotationPlanId).populate("slots.shiftId").lean()
      : null;

    const fixedShift = emp.shiftId
      ? await shiftRepo.findById({ tenantId, branchIds: [emp.branchId.toString()] } as any, emp.shiftId.toString())
      : await shiftRepo.findDefault({ tenantId, branchIds: [emp.branchId.toString()] } as any);

    const schedule = resolveEmployeeDaySchedule({
      targetDate,
      rotationPlan: rotationPlan as any,
      rotationStartDate: emp.rotationStartDate ?? null,
      fixedShift: fixedShift as any,
      fixedWeeklyOffDays: branchWeeklyOffDays,
      customWeekOffRules: branchCustomWeekOffRules,
      holidays: holidays as any,
      employeeBranchId: emp.branchId.toString(),
    });

    let resolvedShiftId = schedule.shift
      ? (schedule.shift as any)._id ?? emp.shiftId
      : emp.shiftId;

    if (!resolvedShiftId) {
      const defaultShift = await shiftRepo.findDefault({ tenantId, branchIds: [emp.branchId.toString()] } as any);
      resolvedShiftId = defaultShift?._id;
    }

    // Check if this employee has biometric punches
    const empCode = (emp.employeeCode || "").trim().toUpperCase();
    const empPunches = logsByCode.get(empCode) || [];

    if (empPunches.length > 0) {
      // ── EMPLOYEE HAS BIOMETRIC PUNCHES ─────────────────────────────────────
      // Sort punches chronologically by punchTime
      empPunches.sort((a, b) => a.punchTime.localeCompare(b.punchTime));

      const firstPunch = empPunches[0];
      const lastPunch = empPunches[empPunches.length - 1];

      // Build Date objects for in and out times
      const [fH, fM, fS] = firstPunch.punchTime.split(":").map(Number);
      const firstCheckIn = new Date(targetDate);
      firstCheckIn.setHours(fH || 0, fM || 0, fS || 0, 0);

      const [lH, lM, lS] = lastPunch.punchTime.split(":").map(Number);
      const lastCheckOut = new Date(targetDate);
      lastCheckOut.setHours(lH || 0, lM || 0, lS || 0, 0);

      // Compute total minutes worked
      let workedMinutes = 0;
      if (empPunches.length > 1) {
        workedMinutes = Math.max(0, Math.round((lastCheckOut.getTime() - firstCheckIn.getTime()) / 60000));
      }

      // Check shift late rules
      let isLate = false;
      if (schedule.shift?.startTime) {
        const [sH, sM] = schedule.shift.startTime.split(":").map(Number);
        const shiftStart = new Date(targetDate);
        shiftStart.setHours(sH || 0, sM || 0, 0, 0);
        const graceMinutes = (schedule.shift as any).gracePeriodMinutes ?? 15;
        const cutoff = new Date(shiftStart.getTime() + graceMinutes * 60000);
        if (firstCheckIn > cutoff) {
          isLate = true;
        }
      }

      // Determine attendance status based on worked hours
      let status: AttendanceStatus;
      if (empPunches.length === 1) {
        // Single punch only (e.g. forgot checkout)
        status = AttendanceStatus.HALF_DAY;
        halfDayCount++;
      } else if (workedMinutes >= 420) {
        // 7+ hours = Full Day Present
        status = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        presentCount++;
      } else if (workedMinutes >= 240) {
        // 4-7 hours = Half Day
        status = AttendanceStatus.HALF_DAY;
        halfDayCount++;
      } else {
        // Less than 4 hours
        status = AttendanceStatus.HALF_DAY;
        halfDayCount++;
      }

      const sessions: any[] = [
        {
          type: SessionType.CHECK_IN,
          timestamp: firstCheckIn,
          source: PunchSource.BIOMETRIC,
        },
      ];

      if (empPunches.length > 1) {
        sessions.push({
          type: SessionType.CHECK_OUT,
          timestamp: lastCheckOut,
          source: PunchSource.BIOMETRIC,
        });
      }

      await AttendanceModel.findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          employeeId: emp._id,
          attendanceDate: targetDate,
        },
        {
          $set: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            branchId: emp.branchId,
            shiftId: resolvedShiftId,
            attendanceDate: targetDate,
            sessions,
            firstCheckIn,
            lastCheckOut: empPunches.length > 1 ? lastCheckOut : undefined,
            workedMinutes,
            status,
            isLate,
            isRegularized: false,
          },
        },
        { upsert: true, new: true }
      );

    } else {
      // ── NO PUNCHES RECORDED FOR THIS EMPLOYEE ─────────────────────────────
      // Only create if no record exists yet
      if (existing) continue;

      let status: AttendanceStatus;
      switch (schedule.dayType) {
        case "HOLIDAY":
          status = AttendanceStatus.HOLIDAY;
          holidayCount++;
          break;
        case "WEEK_OFF":
          status = AttendanceStatus.WEEK_OFF;
          weekOffCount++;
          break;
        default:
          status = AttendanceStatus.ABSENT;
          absentCount++;
      }

      if (resolvedShiftId) {
        await AttendanceModel.create({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          branchId: emp.branchId,
          employeeId: emp._id,
          shiftId: resolvedShiftId,
          attendanceDate: targetDate,
          sessions: [],
          workedMinutes: 0,
          status,
          isRegularized: false,
        });
      }
    }
  }

  logger.info(
    `[AttendanceReconcile] Completed for tenant=${tenantId} | ` +
    `present=${presentCount}, halfDay=${halfDayCount}, absent=${absentCount}, ` +
    `weekOff=${weekOffCount}, holiday=${holidayCount}`
  );

  return {
    processed: employees.length,
    presentCount,
    halfDayCount,
    absentCount,
    weekOffCount,
    holidayCount,
  };
}
