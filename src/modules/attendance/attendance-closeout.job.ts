import mongoose from "mongoose";
import { EmployeeModel } from "../employee/employee.model";
import { AttendanceModel, AttendanceStatus } from "./attendance.model";
import { HolidayModel } from "../leave/holiday.model";
import { BranchModel } from "../branch/branch.model";
import { normalizeToMidnight } from "./attendance.util";
import { logger } from "../../config/logger";

// Runs once daily (via cron, or manually via an admin endpoint) for a given
// date — normally "yesterday". For every active employee who has NO
// attendance document for that date, creates one marked ABSENT, unless
// that date falls on their branch's weekly-off or a holiday, in which case
// it's marked WEEK_OFF or HOLIDAY instead. This is what makes reports
// accurate — a missing punch becomes a real, queryable record.


export async function closeOutAttendanceForDate(
  tenantId: string,
  date:     Date
): Promise<{ processed: number; markedAbsent: number; markedWeekOff: number; markedHoliday: number }> {

  const targetDate = normalizeToMidnight(date);
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dayName = dayNames[targetDate.getDay()];

  const employees = await EmployeeModel.find({
    tenantId:  new mongoose.Types.ObjectId(tenantId),
    isActive:  true,
    isDeleted: false,
  }).select("_id branchId shiftId");

  const holidays = await HolidayModel.find({
    tenantId:  new mongoose.Types.ObjectId(tenantId),
    date:      targetDate,
    isDeleted: false,
  }).select("branchId");

  const holidayBranchIds = new Set(
    holidays.map(h => h.branchId?.toString() ?? "ORG_WIDE")
  );
  const isOrgWideHoliday = holidays.some(h => !h.branchId);

  let markedAbsent = 0, markedWeekOff = 0, markedHoliday = 0;

  for (const emp of employees) {
    const existing = await AttendanceModel.findOne({
      tenantId:       new mongoose.Types.ObjectId(tenantId),
      employeeId:     emp._id,
      attendanceDate: targetDate,
    });

    if (existing) continue; // already has a record — leave it alone

    const branch = await BranchModel.findById(emp.branchId).select("workPolicy");
    const weeklyOffDays = branch?.workPolicy?.weeklyOffDays ?? ["Saturday", "Sunday"];

    let status: AttendanceStatus;

    if (isOrgWideHoliday || holidayBranchIds.has(emp.branchId.toString())) {
      status = AttendanceStatus.HOLIDAY;
      markedHoliday++;
    } else if (weeklyOffDays.includes(dayName)) {
      status = AttendanceStatus.WEEK_OFF;
      markedWeekOff++;
    } else {
      status = AttendanceStatus.ABSENT;
      markedAbsent++;
    }

    await AttendanceModel.create({
      tenantId:       new mongoose.Types.ObjectId(tenantId),
      branchId:       emp.branchId,
      employeeId:     emp._id,
      shiftId:        emp.shiftId,
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