import mongoose from "mongoose";
import { EmployeeModel } from "../employee/employee.model";
import { AttendanceModel, AttendanceStatus } from "./attendance.model";
import { HolidayModel } from "../leave/holiday.model";
import { BranchModel } from "../branch/branch.model";
import { OrganizationModel } from "../organization/organization.model";
import { ShiftRotationPlanModel } from "./shift-rotation-plan.model";
import { ShiftRepository } from "./shift.repository";
import { normalizeToMidnight } from "./attendance.util";
import { resolveEmployeeDaySchedule, SaturdayPolicy } from "./schedule-engine";
import { logger } from "../../config/logger";

// Runs once daily (via cron, or manually via an admin endpoint) for a given
// date — normally "yesterday". For every active employee who has NO
// attendance document for that date, creates one marked ABSENT, unless
// that date falls on their branch's weekly-off, a holiday, or their
// rotation plan's off-days — in which case it's marked WEEK_OFF or HOLIDAY.
// Uses the unified schedule engine so Saturday policy and rotation plan
// off-days are applied consistently everywhere.

const shiftRepo = new ShiftRepository();

export async function closeOutAttendanceForDate(
  tenantId: string,
  date:     Date
): Promise<{ processed: number; markedAbsent: number; markedWeekOff: number; markedHoliday: number }> {

  const targetDate = normalizeToMidnight(date);

  // Fetch org (for Saturday policy fallback) 
  const org = await OrganizationModel.findById(tenantId);
  const orgSaturdayPolicy = (org?.locale as any)?.saturdayPolicy as SaturdayPolicy | undefined;
  const orgWeeklyOffDays  = org?.locale?.weeklyOffDays ?? ["Sunday"];

  //  Fetch all active employees 
  const employees = await EmployeeModel.find({
    tenantId:  new mongoose.Types.ObjectId(tenantId),
    isActive:  true,
    isDeleted: false,
  }).select("_id branchId shiftId rotationPlanId rotationStartDate");

  // ── Fetch holidays for this date 
  const holidays = await HolidayModel.find({
    tenantId:  new mongoose.Types.ObjectId(tenantId),
    date:      targetDate,
    isDeleted: false,
  }).select("branchId name");

  let markedAbsent = 0, markedWeekOff = 0, markedHoliday = 0;

  for (const emp of employees) {
    if (!emp.branchId) continue; // skip employees with no branch configured

    // Skip if attendance record already exists
    const existing = await AttendanceModel.findOne({
      tenantId:       new mongoose.Types.ObjectId(tenantId),
      employeeId:     emp._id,
      attendanceDate: targetDate,
    });
    if (existing) continue;

    // Resolve branch config 
    const branch = await BranchModel.findById(emp.branchId).select("workPolicy");
    const branchWeeklyOffDays  = branch?.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;
    const branchSaturdayPolicy = (branch?.workPolicy as any)?.saturdayPolicy as SaturdayPolicy | undefined
      ?? orgSaturdayPolicy;

    // Resolve rotation plan 
    const rotationPlan = emp.rotationPlanId
      ? await ShiftRotationPlanModel.findById(emp.rotationPlanId)
          .populate("slots.shiftId")
      : null;

    // Resolve fixed shift 
    const fixedShift = emp.shiftId
      ? await shiftRepo.findById({ tenantId, branchIds: [emp.branchId.toString()] } as any, emp.shiftId.toString())
      : await shiftRepo.findDefault({ tenantId, branchIds: [emp.branchId.toString()] } as any);

    // Run the unified schedule engine 
    const schedule = resolveEmployeeDaySchedule({
      targetDate,
      rotationPlan:       rotationPlan as any,
      rotationStartDate:  emp.rotationStartDate ?? null,
      fixedShift:         fixedShift as any,
      fixedWeeklyOffDays: branchWeeklyOffDays,
      saturdayPolicy:     branchSaturdayPolicy,
      holidays:           holidays as any,
      employeeBranchId:   emp.branchId.toString(),
    });

    let status: AttendanceStatus;
    switch (schedule.dayType) {
      case "HOLIDAY":  status = AttendanceStatus.HOLIDAY;  markedHoliday++; break;
      case "WEEK_OFF": status = AttendanceStatus.WEEK_OFF; markedWeekOff++; break;
      default:         status = AttendanceStatus.ABSENT;   markedAbsent++;
    }

    // Determine shiftId to store on the attendance record (rotation-aware)
    const resolvedShiftId = schedule.shift
      ? (schedule.shift as any)._id ?? emp.shiftId
      : emp.shiftId;

    await AttendanceModel.create({
      tenantId:       new mongoose.Types.ObjectId(tenantId),
      branchId:       emp.branchId,
      employeeId:     emp._id,
      shiftId:        resolvedShiftId,
      attendanceDate: targetDate,
      sessions:       [],
      workedMinutes:  0,
      status,
      isRegularized:  false,
    });
  }

  logger.info({
    message: "Attendance closeout complete",
    tenantId, date: targetDate,
    markedAbsent, markedWeekOff, markedHoliday,
  });

  return { processed: employees.length, markedAbsent, markedWeekOff, markedHoliday };
}