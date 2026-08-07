import mongoose from "mongoose";
import { ShiftQuotaUsageDocument, ShiftQuotaUsageModel } from "../models/shift-quota-usage.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

// Mirrors the pattern of GraceUsageRepository.
// All writes are upserts — safe to call on every punch with no risk of duplicates.

export class ShiftQuotaUsageRepository {

  async getOrCreate(
    context:    RequestContext,
    employeeId: string,
    shiftId:    string,
    year:       number,
    month:      number,
    branchId:   string,
  ): Promise<ShiftQuotaUsageDocument> {
    const tenantId = new mongoose.Types.ObjectId(context.tenantId);
    const empId    = new mongoose.Types.ObjectId(employeeId);

    const doc = await ShiftQuotaUsageModel.findOne({
      tenantId,
      employeeId: empId,
      year,
      month,
      isDeleted: false,
    });

    if (doc) return doc;

    return new ShiftQuotaUsageModel({
      tenantId,
      branchId:   new mongoose.Types.ObjectId(branchId),
      employeeId: empId,
      shiftId:    new mongoose.Types.ObjectId(shiftId),
      year,
      month,
      lateCount:       0,
      earlyLeaveCount: 0,
    }).save();
  }

  // Called when an employee's punch results in status = LATE
  async incrementLate(
    context:    RequestContext,
    employeeId: string,
    shiftId:    string,
    year:       number,
    month:      number,
    branchId:   string,
  ): Promise<void> {
    const tenantId  = new mongoose.Types.ObjectId(context.tenantId);
    const empId     = new mongoose.Types.ObjectId(employeeId);
    const branchOId = new mongoose.Types.ObjectId(branchId);
    const shiftOId  = new mongoose.Types.ObjectId(shiftId);

    await ShiftQuotaUsageModel.updateOne(
      { tenantId, employeeId: empId, year, month, isDeleted: false },
      {
        $inc: { lateCount: 1 },
        $setOnInsert: {
          tenantId,
          branchId:   branchOId,
          employeeId: empId,
          shiftId:    shiftOId,
          year,
          month,
        },
      },
      { upsert: true }
    );
  }

  // Called when an employee checks out within the allowed early-leave window
  async incrementEarlyLeave(
    context:    RequestContext,
    employeeId: string,
    shiftId:    string,
    year:       number,
    month:      number,
    branchId:   string,
  ): Promise<void> {
    const tenantId  = new mongoose.Types.ObjectId(context.tenantId);
    const empId     = new mongoose.Types.ObjectId(employeeId);
    const branchOId = new mongoose.Types.ObjectId(branchId);
    const shiftOId  = new mongoose.Types.ObjectId(shiftId);

    await ShiftQuotaUsageModel.updateOne(
      { tenantId, employeeId: empId, year, month, isDeleted: false },
      {
        $inc: { earlyLeaveCount: 1 },
        $setOnInsert: {
          tenantId,
          branchId:   branchOId,
          employeeId: empId,
          shiftId:    shiftOId,
          year,
          month,
        },
      },
      { upsert: true }
    );
  }

  // Returns current usage for reading quota flags in reports
  async getUsage(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number,
  ): Promise<{ lateCount: number; earlyLeaveCount: number }> {
    const doc = await ShiftQuotaUsageModel.findOne({
      tenantId:   new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      year,
      month,
      isDeleted: false,
    }).select("lateCount earlyLeaveCount").lean();

    return {
      lateCount:       doc?.lateCount       ?? 0,
      earlyLeaveCount: doc?.earlyLeaveCount ?? 0,
    };
  }
}
