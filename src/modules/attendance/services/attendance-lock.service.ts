import mongoose from "mongoose";
import {
  AttendanceLockModel,
  AttendanceLockStatus,
} from "../models/attendance-lock.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class AttendanceLockService {

  private async resolveBranchId(context: RequestContext, branchId?: string): Promise<string> {
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      return branchId;
    }
    if (context.branchIds?.[0] && mongoose.Types.ObjectId.isValid(context.branchIds[0])) {
      return context.branchIds[0];
    }
    const branch = await mongoose.model("Branch").findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).sort({ isHeadOffice: -1, createdAt: 1 });

    return branch?._id ? branch._id.toString() : "";
  }

  // Lock a period 
  async lockPeriod(
    context:  RequestContext,
    year:     number,
    month:    number,
    branchId?: string
  ) {
    const targetBranchId = await this.resolveBranchId(context, branchId);
    if (!targetBranchId) {
      throw new AppError("branchId is required to lock attendance.", 400);
    }
    const period = `${year}-${String(month).padStart(2, "0")}`;

    const existing = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(targetBranchId),
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
      branchId:  new mongoose.Types.ObjectId(targetBranchId),
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
    unlockReason: string,
    branchId?:    string
  ) {
    const targetBranchId = await this.resolveBranchId(context, branchId);
    if (!targetBranchId) {
      throw new AppError("branchId is required to unlock attendance.", 400);
    }
    const period = `${year}-${String(month).padStart(2, "0")}`;

    const lock = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(targetBranchId),
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
    context:  RequestContext,
    year:     number,
    month:    number,
    branchId?: string
  ) {
    const targetBranchId = await this.resolveBranchId(context, branchId);
    const period = `${year}-${String(month).padStart(2, "0")}`;

    const query: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      period,
    };
    if (targetBranchId && mongoose.Types.ObjectId.isValid(targetBranchId)) {
      query.branchId = new mongoose.Types.ObjectId(targetBranchId);
    }

    const lock = await AttendanceLockModel.findOne(query).lean();

    return {
      period,
      status:        lock?.status ?? AttendanceLockStatus.OPEN,
      lockedAt:      lock?.lockedAt,
      lockedBy:      lock?.lockedBy,
      payrollLinked: !!lock?.payrollRunId,
    };
  }

  // List all 12 months for a year
  async listYearLocks(context: RequestContext, year: number, branchId?: string) {
    const targetBranchId = await this.resolveBranchId(context, branchId);

    const query: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      period:   { $regex: `^${year}-` },
    };
    if (targetBranchId && mongoose.Types.ObjectId.isValid(targetBranchId)) {
      query.branchId = new mongoose.Types.ObjectId(targetBranchId);
    }

    const locks = await AttendanceLockModel.find(query).lean();

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