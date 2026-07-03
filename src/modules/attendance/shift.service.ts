import mongoose from "mongoose";
import { ShiftRepository } from "./shift.repository";
import { CreateShiftInput, UpdateShiftInput } from "./attendance.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { ShiftModel } from "./shift.model";

export class ShiftService {
  private shiftRepo = new ShiftRepository();

  async createShift(context: RequestContext, input: CreateShiftInput) {
    const existing = await this.shiftRepo.findByCode(context, input.code);
    if (existing) {
      throw new AppError(`Shift code "${input.code}" already exists`, 409);
    }

    if (input.isDefault) {
      await ShiftModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
        { isDefault: false }
      );
    }

    return this.shiftRepo.create(context, {
      tenantId:   new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:   new mongoose.Types.ObjectId(context.branchIds[0] ?? "") as any,
      name:       input.name,
      code:       input.code,
      startTime:  input.startTime,
      endTime:    input.endTime,
      gracePeriodMinutes: input.gracePeriodMinutes,
      halfDayThresholdMinutes: input.halfDayThresholdMinutes,
      fullDayMinutes: input.fullDayMinutes,
      breakDurationMinutes: input.breakDurationMinutes,
      isDefault:  input.isDefault,
      isActive:   true,
    });
  }

  async listShifts(context: RequestContext) {
    return this.shiftRepo.findAll(
      context, { isActive: true }, { pageNumber: 1, pageSize: 50 }
    );
  }

  async getShiftById(context: RequestContext, id: string) {
    const shift = await this.shiftRepo.findById(context, id);
    if (!shift) throw new AppError("Shift not found", 404);
    return shift;
  }

  async updateShift(context: RequestContext, id: string, input: UpdateShiftInput) {
    const shift = await this.shiftRepo.findById(context, id);
    if (!shift) throw new AppError("Shift not found", 404);

    if (input.isDefault) {
      await ShiftModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
        { isDefault: false }
      );
    }

    return this.shiftRepo.updateById(context, id, input);
  }

  async deleteShift(context: RequestContext, id: string) {
    const shift = await this.shiftRepo.findById(context, id);
    if (!shift) throw new AppError("Shift not found", 404);
    if (shift.isDefault) {
      throw new AppError("Cannot delete the default shift. Set another shift as default first.", 400);
    }
    await this.shiftRepo.softDeleteById(context, id);
    return { message: "Shift deleted successfully" };
  }
}