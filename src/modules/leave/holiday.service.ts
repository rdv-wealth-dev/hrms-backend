import mongoose from "mongoose";
import { HolidayRepository } from "./holiday.repository";
import { CreateHolidayInput, UpdateHolidayInput } from "./leave.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class HolidayService {
  private holidayRepo = new HolidayRepository();

  async createHoliday(context: RequestContext, input: CreateHolidayInput) {
    return this.holidayRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: input.branchId
        ? new mongoose.Types.ObjectId(input.branchId) as any
        : undefined,   // undefined = org-wide holiday
      name: input.name,
      date: new Date(input.date),
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

    const updateData: Record<string, unknown> = { ...input };
    if (input.date) updateData.date = new Date(input.date);
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

