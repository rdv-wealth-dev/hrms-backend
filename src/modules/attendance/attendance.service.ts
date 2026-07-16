import mongoose from "mongoose";
import { AttendanceRepository } from "./attendance.repository";
import { ShiftRepository } from "./shift.repository";
import { AttendanceModel, AttendanceStatus, PunchSource, SessionType } from "./attendance.model";
import { PunchInput, ManualAttendanceInput } from "./attendance.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import {
    checkGeofence,
    calculateAttendanceStatus,
    calculateWorkedMinutes,
    normalizeToMidnight
} from "./attendance.util"
import { UserModel } from "../user/user.model";
import { BranchModel } from "../branch/branch.model";
import { EmployeeModel } from "../employee/employee.model";
import { GraceUsageRepository } from "./grace-usage.repository";


export class AttendanceService {
  private attRepo       = new AttendanceRepository();
  private shiftRepo     = new ShiftRepository();
  private graceRepo     = new GraceUsageRepository();

  // Resolve the calling user's own employeeId
  private async resolveOwnEmployeeId(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id:       new mongoose.Types.ObjectId(context.userId),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("employeeId");

    if (!user || !user.employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }

    return user.employeeId.toString();
  }

  private resolveBranchId(
    employeeBranchId: mongoose.Types.ObjectId | undefined | null,
    context: RequestContext,
    userBranchIds?: mongoose.Types.ObjectId[],
  ): string {
    const branchId =
      employeeBranchId?.toString() ??
      context.branchIds?.[0] ??
      userBranchIds?.[0]?.toString();

    if (!branchId) {
      throw new AppError(
        "Employee branch is not configured. Contact HR.",
        400
      );
    }

    return branchId;
  }

  //Self-service punch — check-in / break-out / break-in / check-out
  async punch(
    context: RequestContext,
    input:   PunchInput,
    source:  PunchSource,
    ipAddress?: string,
    deviceInfo?: string
  ) {
    const user = await UserModel.findOne({
      _id:       new mongoose.Types.ObjectId(context.userId),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("employeeId branchIds");

    if (!user?.employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }

    const employeeId = user.employeeId.toString();
    const today = normalizeToMidnight(new Date());

    // Resolve shift — fall back to tenant default if employee has none assigned yet
    const employeeDoc = await EmployeeModel.findById(employeeId).select("shiftId branchId");
    const shift = employeeDoc?.shiftId
      ? await this.shiftRepo.findById(context, employeeDoc.shiftId.toString())
      : await this.shiftRepo.findDefault(context);
    if (!shift) {
      throw new AppError(
        "No default shift configured for this organization. Contact HR.",
        400
      );
    }

    const branchId = this.resolveBranchId(
      employeeDoc?.branchId,
      context,
      user.branchIds,
    );

    // Geofence check — only meaningful for MOBILE punches
    let withinGeofence: boolean | null = null;
    if (source === PunchSource.MOBILE) {
      const branch = await BranchModel.findById(branchId);
      const geoResult = checkGeofence(branch?.geo, input.lat, input.lng);
      withinGeofence = geoResult.withinGeofence;

      if (withinGeofence === false) {
        throw new AppError(
          `You appear to be ${geoResult.distanceMeters}m from your branch location. Check-in requires being within the branch premises.`,
          403
        );
      }
    }

    let attendance = await this.attRepo.findByEmployeeAndDate(context, employeeId, today);

    if (!attendance) {
      if (input.type !== SessionType.CHECK_IN) {
        throw new AppError(
          "You must check in before performing this action", 400
        );
      }

      attendance = await this.attRepo.create({
        tenantId:       new mongoose.Types.ObjectId(context.tenantId) as any,
        branchId:       new mongoose.Types.ObjectId(branchId) as any,
        employeeId:     new mongoose.Types.ObjectId(employeeId) as any,
        shiftId:        shift._id as any,
        attendanceDate: today,
        sessions:       [],
        status:         AttendanceStatus.ABSENT,
        workedMinutes:  0,
        isRegularized:  false,
      });
    } else {
      // Validate punch sequence — can't check in twice, can't check out before checking in, etc.
      this.validatePunchSequence(attendance.sessions.map(s => s.type), input.type);
    }

    if (!attendance.branchId) {
      attendance.branchId = new mongoose.Types.ObjectId(branchId) as any;
    }

    attendance.sessions.push({
      type:      input.type as SessionType,
      timestamp: new Date(),
      source,
      lat:       input.lat,
      lng:       input.lng,
      ipAddress,
      deviceInfo,
      withinGeofence,
    });

    if (input.type === SessionType.CHECK_IN && !attendance.firstCheckIn) {
      attendance.firstCheckIn = new Date();
    }
    if (input.type === SessionType.CHECK_OUT) {
      attendance.lastCheckOut = new Date();
    }

    attendance.workedMinutes = calculateWorkedMinutes(attendance.sessions);

    // Grace usage tracking — only if shift has a per-month limit
    let graceUsed = 0;
    if (input.type === SessionType.CHECK_IN && (shift.graceLimitPerMonth ?? 0) > 0) {
      const now = new Date();
      const usage = await this.graceRepo.getOrCreate(
        context, employeeId, now.getFullYear(), now.getMonth() + 1, branchId
      );
      graceUsed = usage.used;
    }

    // Recompute status on every punch — always reflects current state
    attendance.status = calculateAttendanceStatus(
      shift,
      attendance.firstCheckIn ?? null,
      attendance.workedMinutes,
      graceUsed,
      shift.graceLimitPerMonth
    );

    // If check-in was within grace period, increment the monthly counter
    if (input.type === SessionType.CHECK_IN && attendance.status === AttendanceStatus.PRESENT) {
      const now = new Date();
      const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
      const shiftStart = new Date();
      shiftStart.setHours(shiftHour, shiftMin, 0, 0);
      if (attendance.firstCheckIn && attendance.firstCheckIn > shiftStart) {
        await this.graceRepo.increment(
          context, employeeId, now.getFullYear(), now.getMonth() + 1, branchId
        );
      }
    }

    await this.attRepo.save(attendance);
    return attendance;
  }

  private validatePunchSequence(existingTypes: string[], newType: string): void {
    const last = existingTypes[existingTypes.length - 1];

    const validNext: Record<string, string[]> = {
      [""]:                        [SessionType.CHECK_IN],
      [SessionType.CHECK_IN]:      [SessionType.BREAK_OUT, SessionType.CHECK_OUT],
      [SessionType.BREAK_OUT]:     [SessionType.BREAK_IN],
      [SessionType.BREAK_IN]:      [SessionType.BREAK_OUT, SessionType.CHECK_OUT],
      [SessionType.CHECK_OUT]:     [], // day is closed
    };

    const allowed = validNext[last ?? ""] ?? [];
    if (!allowed.includes(newType)) {
      throw new AppError(
        `Cannot perform ${newType} — your last action was ${last || "none"}. ` +
        `Request a regularization if a punch was missed.`,
        400
      );
    }
  }

  //Self-service — own attendance history
  async getMyHistory(context: RequestContext, fromDate: Date, toDate: Date) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    return this.attRepo.findHistoryForEmployee(context, employeeId, fromDate, toDate);
  }

  //Self-service — today's status
  async getMyToday(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    const today = normalizeToMidnight(new Date());
    const record = await this.attRepo.findByEmployeeAndDate(context, employeeId, today);
    return record ?? { status: "NOT_CHECKED_IN", sessions: [] };
  }

  // Admin — manual entry / correction 
  async manualEntry(context: RequestContext, input: ManualAttendanceInput) {
    const date = normalizeToMidnight(new Date(input.attendanceDate));

    let attendance = await this.attRepo.findByEmployeeAndDate(
      context, input.employeeId, date
    );

    const shift = await this.shiftRepo.findDefault(context);
    if (!shift) throw new AppError("No default shift configured", 400);

    const employee = await EmployeeModel.findById(input.employeeId).select("branchId");
    if (!employee) throw new AppError("Employee not found", 404);

    const branchId = this.resolveBranchId(employee.branchId, context);

    if (!attendance) {
      attendance = await this.attRepo.create({
        tenantId:       new mongoose.Types.ObjectId(context.tenantId) as any,
        branchId:       new mongoose.Types.ObjectId(branchId) as any,
        employeeId:     new mongoose.Types.ObjectId(input.employeeId) as any,
        shiftId:        shift._id as any,
        attendanceDate: date,
        sessions:       [],
        status:         AttendanceStatus.ABSENT,
        workedMinutes:  0,
        isRegularized:  true,
        notes:          input.notes,
      });
    }

    if (input.checkIn) {
      attendance.sessions.push({
        type: SessionType.CHECK_IN,
        timestamp: new Date(input.checkIn),
        source: PunchSource.MANUAL,
      });
      attendance.firstCheckIn = new Date(input.checkIn);
    }

    if (input.checkOut) {
      attendance.sessions.push({
        type: SessionType.CHECK_OUT,
        timestamp: new Date(input.checkOut),
        source: PunchSource.MANUAL,
      });
      attendance.lastCheckOut = new Date(input.checkOut);
    }

    attendance.workedMinutes = calculateWorkedMinutes(attendance.sessions);
    attendance.status = input.status as AttendanceStatus ??
      calculateAttendanceStatus(shift, attendance.firstCheckIn ?? null, attendance.workedMinutes);
    attendance.isRegularized = true;
    if (input.notes) attendance.notes = input.notes;

    await this.attRepo.save(attendance);
    return attendance;
  }

  // Admin — report/list
  async getReport(
    context: RequestContext,
    filters: Record<string, unknown>,
    page: number,
    pageSize: number
  ) {
    return this.attRepo.findReport(context, filters, page, pageSize);
  }
}