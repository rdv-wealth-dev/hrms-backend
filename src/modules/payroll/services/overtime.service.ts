import mongoose from "mongoose";
import { OvertimeModel, OvertimeDocument, OTStatus, OTType } from "../models/overtime.model";
import { OvertimeConfigModel } from "../models/statutory-config.model";
import { AttendanceModel } from "../../attendance/models/attendance.model";
import { SalaryStructureRepository } from "../repositories/salary-structure.repository";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeModel } from "../../employee/models/employee.model";

export class OvertimeService {
  private structureRepo = new SalaryStructureRepository();

  // COMPUTE OT FOR A DAY
  // Called by attendance.service.ts after every CHECK_OUT and manualEntry.
  // Uses upsert — safe to call multiple times (idempotent).

  async computeForDay(
    tenantId: string,
    branchId: string,
    employeeId: string,
    date: Date
  ): Promise<OvertimeDocument | null> {

    const tenantOid = new mongoose.Types.ObjectId(tenantId);
    const branchOid = new mongoose.Types.ObjectId(branchId);
    const employeeOid = new mongoose.Types.ObjectId(employeeId);

    // ── Load OT config for this branch 
    const config = await OvertimeConfigModel.findOne({
      tenantId: tenantOid,
      branchId: branchOid,
      isActive: true,
      isDeleted: false,
    }).lean();

    const standardHours = config?.standardHoursPerDay ?? 8;
    const standardMinutes = standardHours * 60;
    const otMultiplier = config?.otMultiplier ?? 2.0;
    const holidayOtMultiplier = config?.holidayOtMultiplier ?? 2.0;
    const maxOtMinPerDay = (config?.maxOtHoursPerDay ?? 4) * 60;
    const eligibleTypes = config?.otEligibleEmployeeTypes ?? ["FULL_TIME", "CONTRACT"];

    // ── Check employee OT eligibility 
    const employee = await EmployeeModel.findOne({
      _id: employeeOid,
      tenantId: tenantOid,
      isDeleted: false,
    }).select("employeeType").lean();

    if (!employee || !eligibleTypes.includes(employee.employeeType)) {
      return null;
    }

    // ── Get attendance record for this day 
    const attendance = await AttendanceModel.findOne({
      tenantId: tenantOid,
      employeeId: employeeOid,
      attendanceDate: date,
      isDeleted: false,
    }).lean();

    if (!attendance || attendance.workedMinutes <= standardMinutes) {
      return null;  // No OT if not worked beyond standard hours
    }

    // ── Determine OT type and multiplier 
    let otType = OTType.REGULAR;
    let multiplier = otMultiplier;

    if (attendance.status === "HOLIDAY") {
      otType = OTType.HOLIDAY;
      multiplier = holidayOtMultiplier;
    } else if (attendance.status === "WEEK_OFF") {
      otType = OTType.WEEK_OFF;
      multiplier = holidayOtMultiplier;
    }

    // ── OT minutes — capped at maxOtHoursPerDay 
    const rawOtMinutes = attendance.workedMinutes - standardMinutes;
    const otMinutes = Math.min(rawOtMinutes, maxOtMinPerDay);
    const otHours = Math.round((otMinutes / 60) * 100) / 100;

    // ── Hourly rate — (Basic + DA) / (26 working days × standard hours) 
    const context = {
      tenantId,
      userId: "system",
      branchIds: [branchId],
      role: "SYSTEM",
    } as any;

    const structure = await this.structureRepo.findActiveForEmployee(
      context, employeeId
    );

    let hourlyRate = 0;
    if (structure) {
      const basicItem = structure.lineItems.find(li => li.componentCode === "BASIC");
      const daItem = structure.lineItems.find(li => li.componentCode === "DA");
      const basicDA = (basicItem?.amount ?? 0) + (daItem?.amount ?? 0);
      hourlyRate = Math.round((basicDA / (26 * standardHours)) * 100) / 100;
    }

    const otAmount = Math.round(otHours * hourlyRate * multiplier * 100) / 100;

    const attendanceDate = new Date(date);
    const month = attendanceDate.getMonth() + 1;
    const year = attendanceDate.getFullYear();

    // ── Upsert — one OT record per employee per day 
    return OvertimeModel.findOneAndUpdate(
      {
        tenantId: tenantOid,
        employeeId: employeeOid,
        attendanceDate: date,
      },
      {
        $set: {
          tenantId: tenantOid,
          branchId: branchOid,
          employeeId: employeeOid,
          attendanceDate: date,
          otType,
          standardMinutes,
          workedMinutes: attendance.workedMinutes,
          otMinutes,
          otHours,
          hourlyRate,
          otMultiplier: multiplier,
          otAmount,
          status: OTStatus.PENDING,
          month,
          year,
          isDeleted: false,
        },
      },
      { upsert: true, new: true }
    );
  }

  // APPROVE

  async approve(context: RequestContext, id: string): Promise<OvertimeDocument> {
    const ot = await OvertimeModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!ot) throw new AppError("Overtime record not found", 404);
    if (ot.status !== OTStatus.PENDING) {
      throw new AppError(`Cannot approve — status is ${ot.status}`, 400);
    }

    ot.status = OTStatus.APPROVED;
    ot.approvedBy = new mongoose.Types.ObjectId(context.userId);
    ot.approvedAt = new Date();
    return ot.save();
  }

  // REJECT

  async reject(
    context: RequestContext,
    id: string,
    reason: string
  ): Promise<OvertimeDocument> {
    const ot = await OvertimeModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!ot) throw new AppError("Overtime record not found", 404);
    if (ot.status !== OTStatus.PENDING) {
      throw new AppError(`Cannot reject — status is ${ot.status}`, 400);
    }

    ot.status = OTStatus.REJECTED;
    ot.rejectionReason = reason;
    return ot.save();
  }

  // LIST PENDING — manager approval dashboard

  async listPending(
    context: RequestContext,
    year: number,
    month: number
  ): Promise<OvertimeDocument[]> {
    return OvertimeModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      year,
      month,
      status: OTStatus.PENDING,
      isDeleted: false,
    })
      .populate("employeeId", "employeeCode firstName lastName")
      .sort({ attendanceDate: 1 })
      .lean() as any;
  }

  // LIST FOR EMPLOYEE — one employee, one month

  async listForEmployee(
    context: RequestContext,
    employeeId: string,
    year: number,
    month: number
  ): Promise<OvertimeDocument[]> {
    return OvertimeModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      year,
      month,
      isDeleted: false,
    })
      .sort({ attendanceDate: 1 })
      .lean() as any;
  }
}