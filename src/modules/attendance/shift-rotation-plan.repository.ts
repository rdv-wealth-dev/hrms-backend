import mongoose from "mongoose";
import { ShiftRotationPlanModel, ShiftRotationPlanDocument } from "./shift-rotation-plan.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class ShiftRotationPlanRepository {

  private tenantFilter(context: RequestContext) {
    return {
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };
  }

  async create(
    context: RequestContext,
    data: Partial<ShiftRotationPlanDocument>
  ): Promise<ShiftRotationPlanDocument> {
    return ShiftRotationPlanModel.create({
      ...data,
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    });
  }

  async findAll(context: RequestContext): Promise<ShiftRotationPlanDocument[]> {
    return ShiftRotationPlanModel.find(this.tenantFilter(context))
      .populate("slots.shiftId", "name code startTime endTime")
      .sort({ createdAt: -1 }) as any;
  }

  async findById(
    context: RequestContext,
    id: string
  ): Promise<ShiftRotationPlanDocument | null> {
    return ShiftRotationPlanModel.findOne({
      _id:      new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).populate("slots.shiftId", "name code startTime endTime gracePeriodMinutes graceLimitPerMonth halfDayThresholdMinutes fullDayMinutes breakDurationMinutes");
  }

  async findByIdRaw(id: string): Promise<ShiftRotationPlanDocument | null> {
    return ShiftRotationPlanModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      isDeleted: false,
    });
  }

  async updateById(
    context: RequestContext,
    id: string,
    data: Partial<ShiftRotationPlanDocument>
  ): Promise<ShiftRotationPlanDocument | null> {
    return ShiftRotationPlanModel.findOneAndUpdate(
      {
        _id:      new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    ).populate("slots.shiftId", "name code startTime endTime");
  }

  async softDeleteById(context: RequestContext, id: string): Promise<void> {
    await ShiftRotationPlanModel.findOneAndUpdate(
      {
        _id:      new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      },
      { $set: { isDeleted: true } }
    );
  }
}
