import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { BranchModel } from "./branch.model";
import { OrganizationModel } from "../organization/organization.model";
import { HolidayModel } from "../leave/holiday.model";
import { ShiftRotationPlanModel } from "../attendance/shift-rotation-plan.model";
import { EmployeeModel } from "../employee/employee.model";
import { UserModel } from "../user/user.model";
import {
  generateMonthCalendar,
  resolveEmployeeDaySchedule,
  SaturdayPolicy,
  CalendarDay,
  formatDate,
} from "../attendance/schedule-engine";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AppError } from "../../core/errors/app.error";
import { normalizeToMidnight } from "../attendance/attendance.util";
import { ShiftRepository } from "../attendance/shift.repository";

const shiftRepo = new ShiftRepository();

//BRANCH CALENDAR

/**
 * GET /api/v1/branches/:branchId/calendar?year=2026&month=7
 *
 * Returns a month-level calendar for a branch — showing which days are
 * WORKING, WEEK_OFF (with off reason), or HOLIDAY.
 * Accessible to all authenticated employees.
 */
export async function getBranchCalendar(req: any, res: Response, next: NextFunction) {
  try {
    const branchId = req.params.branchId;
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) throw new AppError("month must be 1–12", 400);
    if (year  < 2000 || year > 2100) throw new AppError("year out of range", 400);

    // Verify branch belongs to this tenant
    const branch = await BranchModel.findOne({
      _id:       new mongoose.Types.ObjectId(branchId),
      tenantId:  new mongoose.Types.ObjectId(req.context.tenantId),
      isDeleted: false,
    });
    if (!branch) throw new AppError("Branch not found", 404);

    const org = await OrganizationModel.findById(req.context.tenantId);
    const orgSaturdayPolicy  = (org?.locale as any)?.saturdayPolicy as SaturdayPolicy | undefined;
    const orgWeeklyOffDays   = org?.locale?.weeklyOffDays ?? ["Sunday"];

    const branchSaturdayPolicy = (branch.workPolicy as any)?.saturdayPolicy as SaturdayPolicy | undefined
      ?? orgSaturdayPolicy;
    const branchWeeklyOffDays  = branch.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;

    // Holidays for the month
    const fromDate = new Date(year, month - 1, 1);
    const toDate   = new Date(year, month, 0, 23, 59, 59);
    const holidays = await HolidayModel.find({
      tenantId:  new mongoose.Types.ObjectId(req.context.tenantId),
      date:      { $gte: fromDate, $lte: toDate },
      isDeleted: false,
      $or: [{ branchId: null }, { branchId: new mongoose.Types.ObjectId(branchId) }],
    });

    const days = generateMonthCalendar({
      year,
      month,
      fixedWeeklyOffDays: branchWeeklyOffDays,
      saturdayPolicy:     branchSaturdayPolicy,
      holidays:           holidays as any,
      branchId,
    });

    const summary = buildCalendarSummary(days);

    res.status(200).json(buildSuccessResponse({
      branchId,
      branchName:         branch.name,
      year,
      month,
      saturdayPolicyMode: branchSaturdayPolicy?.mode ?? "NONE",
      days,
      summary,
    }, "Branch calendar fetched"));
  } catch (err) {
    next(err);
  }
}

//SELF-SERVICE (MY BRANCH CALENDAR)

/**
 * GET /api/v1/branches/my/calendar?year=2026&month=7
 *
 * Same as above but automatically resolves the calling employee's branch.
 */
export async function getMyBranchCalendar(req: any, res: Response, next: NextFunction) {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const user = await UserModel.findOne({ _id: req.context.userId }).select("employeeId");
    if (!user?.employeeId) throw new AppError("No employee linked to this account", 404);

    const employee = await EmployeeModel.findById(user.employeeId).select("branchId");
    if (!employee?.branchId) throw new AppError("No branch assigned to employee", 400);

    // Delegate to the branch calendar handler via a param shim
    req.params.branchId = employee.branchId.toString();
    return getBranchCalendar(req, res, next);
  } catch (err) {
    next(err);
  }
}

//PERSONAL SCHEDULE (ROTATION-AWARE)
/**
 * GET /api/v1/branches/me/schedule?year=2026&month=7
 *
 * Returns a month-level schedule for the calling employee — rotation-aware.
 * Each day shows which shift is active and whether the day is WORKING/WEEK_OFF/HOLIDAY.
 */
export async function getMyPersonalSchedule(req: any, res: Response, next: NextFunction) {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) throw new AppError("month must be 1–12", 400);
    if (year  < 2000 || year > 2100) throw new AppError("year out of range", 400);

    const user = await UserModel.findOne({ _id: req.context.userId }).select("employeeId");
    if (!user?.employeeId) throw new AppError("No employee linked to this account", 404);

    const employee = await EmployeeModel.findById(user.employeeId)
      .select("branchId shiftId rotationPlanId rotationStartDate");
    if (!employee) throw new AppError("Employee not found", 404);
    if (!employee.branchId) throw new AppError("No branch assigned to employee", 400);

    const branch = await BranchModel.findById(employee.branchId).select("workPolicy name");
    const org    = await OrganizationModel.findById(req.context.tenantId);

    const orgSaturdayPolicy  = (org?.locale as any)?.saturdayPolicy as SaturdayPolicy | undefined;
    const orgWeeklyOffDays   = org?.locale?.weeklyOffDays ?? ["Sunday"];
    const branchSaturdayPolicy = (branch?.workPolicy as any)?.saturdayPolicy as SaturdayPolicy | undefined
      ?? orgSaturdayPolicy;
    const branchWeeklyOffDays  = branch?.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;

    const rotationPlan = employee.rotationPlanId
      ? await ShiftRotationPlanModel.findById(employee.rotationPlanId).populate("slots.shiftId")
      : null;

    const fixedShift = employee.shiftId
      ? await shiftRepo.findById(
          { tenantId: req.context.tenantId, branchIds: [employee.branchId.toString()] } as any,
          employee.shiftId.toString()
        )
      : await shiftRepo.findDefault(
          { tenantId: req.context.tenantId, branchIds: [employee.branchId.toString()] } as any
        );

    const fromDate = new Date(year, month - 1, 1);
    const toDate   = new Date(year, month, 0, 23, 59, 59);
    const holidays = await HolidayModel.find({
      tenantId:  new mongoose.Types.ObjectId(req.context.tenantId),
      date:      { $gte: fromDate, $lte: toDate },
      isDeleted: false,
      $or: [{ branchId: null }, { branchId: employee.branchId }],
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: Array<CalendarDay & {
      shift?: { name: string; code: string; startTime: string; endTime: string };
      slotNumber?: number;
    }> = [];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const date = normalizeToMidnight(new Date(year, month - 1, dayNum));

      const schedule = resolveEmployeeDaySchedule({
        targetDate:         date,
        rotationPlan:       rotationPlan as any,
        rotationStartDate:  employee.rotationStartDate ?? null,
        fixedShift:         fixedShift as any,
        fixedWeeklyOffDays: branchWeeklyOffDays,
        saturdayPolicy:     branchSaturdayPolicy,
        holidays:           holidays as any,
        employeeBranchId:   employee.branchId.toString(),
      });

      const holiday = holidays.find((h) => {
        const hd = new Date(h.date);
        return hd.getDate() === dayNum && hd.getMonth() === month - 1 && hd.getFullYear() === year;
      });

      days.push({
        date:        formatDate(date),
        dayOfWeek:   ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()],
        type:        schedule.dayType,
        offReason:   schedule.offReason,
        holidayName: holiday?.name,
        slotNumber:  schedule.slotNumber,
        shift:       schedule.shift
          ? {
              name:      (schedule.shift as any).name,
              code:      (schedule.shift as any).code,
              startTime: (schedule.shift as any).startTime,
              endTime:   (schedule.shift as any).endTime,
            }
          : undefined,
      });
    }

    const summary = buildCalendarSummary(days);

    res.status(200).json(buildSuccessResponse({
      employeeId:     employee._id,
      branchName:     branch?.name,
      year,
      month,
      rotationPlan:   rotationPlan
        ? { name: (rotationPlan as any).name, cycleDuration: (rotationPlan as any).cycleDuration }
        : null,
      saturdayPolicyMode: branchSaturdayPolicy?.mode ?? "NONE",
      days,
      summary,
    }, "Personal schedule fetched"));
  } catch (err) {
    next(err);
  }
}

// HELPER 

function buildCalendarSummary(days: CalendarDay[]) {
  return {
    totalDays:   days.length,
    workingDays: days.filter((d) => d.type === "WORKING").length,
    weekOffs:    days.filter((d) => d.type === "WEEK_OFF").length,
    holidays:    days.filter((d) => d.type === "HOLIDAY").length,
    saturdays:   days.filter((d) => d.dayOfWeek === "Saturday").length,
    saturdaysOff: days.filter((d) => d.dayOfWeek === "Saturday" && d.type !== "WORKING").length,
  };
}
