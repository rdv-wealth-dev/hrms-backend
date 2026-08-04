import mongoose from "mongoose";
import {
  AttendanceLockModel,
  AttendanceLockStatus,
} from "../models/attendance-lock.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class AttendanceLockService {

  // Lock a period 
  async lockPeriod(
    context: RequestContext,
    year:    number,
    month:   number
  ) {
    const branchId = context.branchIds[0] ?? "";
    const period   = `${year}-${String(month).padStart(2, "0")}`;

    const existing = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      period,
    });

    if (existing?.status === AttendanceLockStatus.LOCKED) {
      throw new AppError(`Attendance for ${period} is already locked.`, 409);
    }

    if (existing) {
      existing.status   = AttendanceLockStatus.LOCKED;
      existing.lockedAt = new Date();
      existing.lockedBy = new mongoose.Types.ObjectId(context.userId);
      return existing.save();
    }

    return AttendanceLockModel.create({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(branchId),
      period,
      status:    AttendanceLockStatus.LOCKED,
      lockedAt:  new Date(),
      lockedBy:  new mongoose.Types.ObjectId(context.userId),
    });
  }

  // Unlock a period 
  async unlockPeriod(
    context:      RequestContext,
    year:         number,
    month:        number,
    unlockReason: string
  ) {
    const branchId = context.branchIds[0] ?? "";
    const period   = `${year}-${String(month).padStart(2, "0")}`;

    const lock = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      period,
    });

    if (!lock) {
      throw new AppError(`No lock record found for ${period}.`, 404);
    }

    // Cannot unlock if payroll already ran and was paid for this period
    if (lock.payrollRunId) {
      throw new AppError(
        `Cannot unlock: Payroll for ${period} has already been processed and paid. ` +
        `Corrections must go through a supplementary payroll run.`,
        403
      );
    }

    if (lock.status !== AttendanceLockStatus.LOCKED) {
      throw new AppError(
        `Attendance for ${period} is not currently locked.`,
        400
      );
    }

    lock.status       = AttendanceLockStatus.UNLOCKED;
    lock.unlockedAt   = new Date();
    lock.unlockedBy   = new mongoose.Types.ObjectId(context.userId);
    lock.unlockReason = unlockReason;
    return lock.save();
  }

  // Get lock status for one period 
  async getLockStatus(
    context: RequestContext,
    year:    number,
    month:   number
  ) {
    const branchId = context.branchIds[0] ?? "";
    const period   = `${year}-${String(month).padStart(2, "0")}`;

    const lock = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      period,
    }).lean();

    return {
      period,
      status:        lock?.status ?? AttendanceLockStatus.OPEN,
      lockedAt:      lock?.lockedAt,
      lockedBy:      lock?.lockedBy,
      payrollLinked: !!lock?.payrollRunId,
    };
  }

  // List all 12 months for a year
  async listYearLocks(context: RequestContext, year: number) {
    const branchId = context.branchIds[0] ?? "";

    const locks = await AttendanceLockModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      year,
    }).lean();

    // Derive month number from period string (e.g. "2026-07" → 7)
    const lockMap = new Map(locks.map(l => [parseInt(l.period.split("-")[1], 10), l]));

    // Always return all 12 months even if no lock record exists yet
    return Array.from({ length: 12 }, (_, i) => {
      const m    = i + 1;
      const lock = lockMap.get(m);
      return {
        month:         m,
        period:        `${year}-${String(m).padStart(2, "0")}`,
        status:        lock?.status ?? AttendanceLockStatus.OPEN,
        lockedAt:      lock?.lockedAt,
        payrollLinked: !!lock?.payrollRunId,
      };
    });
  }
}