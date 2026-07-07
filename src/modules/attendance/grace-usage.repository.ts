import mongoose from "mongoose";
import { GraceUsageDocument, GraceUsageModel } from "./grace-usage.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class GraceUsageRepository {
  async getOrCreate(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number
  ): Promise<GraceUsageDocument> {
    const doc = await GraceUsageModel.findOne({
      tenantId:   new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      year,
      month,
      isDeleted: false,
    });

    if (doc) return doc;

    return new GraceUsageModel({
      tenantId:   new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      year,
      month,
      used: 0,
    }).save();
  }

  async increment(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number
  ): Promise<void> {
    await GraceUsageModel.updateOne(
      {
        tenantId:   new mongoose.Types.ObjectId(context.tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        year,
        month,
      },
      { $inc: { used: 1 } },
      { upsert: true }
    );
  }
}
