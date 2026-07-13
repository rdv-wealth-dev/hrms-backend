import mongoose from "mongoose";
import { HolidayRepository } from "./holiday.repository";
import { CreateHolidayInput, UpdateHolidayInput } from "./leave.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { HolidayModel } from "./holiday.model";

export class HolidayService {
  private holidayRepo = new HolidayRepository();

  async createHoliday(context: RequestContext, input: CreateHolidayInput) {
    const normalizedDate = new Date(input.date);
    normalizedDate.setHours(0, 0, 0, 0);

    let conflict;
    if (input.branchId) {
      // Creating branch-specific holiday: conflicts with either same branch holiday or an org-wide holiday
      conflict = await HolidayModel.findOne({
        tenantId: context.tenantId,
        date: normalizedDate,
        isDeleted: false,
        $or: [
          { branchId: new mongoose.Types.ObjectId(input.branchId) },
          { branchId: { $exists: false } },
          { branchId: null }
        ]
      });
    } else {
      // Creating org-wide holiday: conflicts with any existing holiday on that date
      conflict = await HolidayModel.findOne({
        tenantId: context.tenantId,
        date: normalizedDate,
        isDeleted: false
      });
    }

    if (conflict) {
      throw new AppError(`A holiday ("${conflict.name}") already exists on this date`, 409);
    }

    return this.holidayRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: input.branchId
        ? new mongoose.Types.ObjectId(input.branchId) as any
        : undefined,   // undefined = org-wide holiday
      name: input.name,
      date: normalizedDate,
      type: input.type as any,
      isOptional: input.isOptional,
      description: input.description,
    });
  }

  async listHolidays(context: RequestContext, year: number) {
    return this.holidayRepo.findForYear(context, year);
  }

  async getHolidayById(context: RequestContext, id: string) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);
    return holiday;
  }

  async updateHoliday(context: RequestContext, id: string, input: UpdateHolidayInput) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);

    const checkDate = input.date ? new Date(input.date) : holiday.date;
    checkDate.setHours(0, 0, 0, 0);

    const checkBranchId = input.branchId !== undefined ? input.branchId : holiday.branchId?.toString();

    let conflict;
    if (checkBranchId) {
      conflict = await HolidayModel.findOne({
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        tenantId: context.tenantId,
        date: checkDate,
        isDeleted: false,
        $or: [
          { branchId: new mongoose.Types.ObjectId(checkBranchId) },
          { branchId: { $exists: false } },
          { branchId: null }
        ]
      });
    } else {
      conflict = await HolidayModel.findOne({
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        tenantId: context.tenantId,
        date: checkDate,
        isDeleted: false
      });
    }

    if (conflict) {
      throw new AppError(`A holiday ("${conflict.name}") already exists on this date`, 409);
    }

    const updateData: Record<string, unknown> = { ...input };
    if (input.date) updateData.date = checkDate;
    if (input.branchId) updateData.branchId = new mongoose.Types.ObjectId(input.branchId);

    return this.holidayRepo.updateById(context, id, updateData);
  }

  async deleteHoliday(context: RequestContext, id: string) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);
    await this.holidayRepo.softDeleteById(context, id);
    return { message: "Holiday deleted successfully" };
  }
}

