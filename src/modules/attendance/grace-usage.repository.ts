import mongoose from "mongoose";
import { GraceUsageDocument, GraceUsageModel } from "./grace-usage.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class GraceUsageRepository {
  async getOrCreate(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number,
    branchId:   string,
  ): Promise<GraceUsageDocument> {
    const tenantId = new mongoose.Types.ObjectId(context.tenantId);
    const empId    = new mongoose.Types.ObjectId(employeeId);

    const doc = await GraceUsageModel.findOne({
      tenantId,
      employeeId: empId,
      year,
      month,
      isDeleted: false,
    });

    if (doc) return doc;

    return new GraceUsageModel({
      tenantId,
      branchId:   new mongoose.Types.ObjectId(branchId),
      employeeId: empId,
      year,
      month,
      used: 0,
    }).save();
  }

  async increment(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number,
    branchId:   string,
  ): Promise<void> {
    const tenantId = new mongoose.Types.ObjectId(context.tenantId);
    const empId    = new mongoose.Types.ObjectId(employeeId);
    const branchOId = new mongoose.Types.ObjectId(branchId);

    await GraceUsageModel.updateOne(
      {
        tenantId,
        employeeId: empId,
        year,
        month,
        isDeleted: false,
      },
      {
        $inc: { used: 1 },
        $setOnInsert: {
          tenantId,
          branchId:   branchOId,
          employeeId: empId,
          year,
          month,
        },
      },
      { upsert: true }
    );
  }
}
