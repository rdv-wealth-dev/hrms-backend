import mongoose from "mongoose";
import { ShiftRepository } from "./shift.repository";
import { CreateShiftInput, UpdateShiftInput } from "./attendance.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { ShiftModel } from "./shift.model";
import { EmployeeModel } from "../employee/employee.model";
import { AssignShiftInput } from "./shift-assignment.dto";

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
      graceLimitPerMonth: input.graceLimitPerMonth,
      halfDayThresholdMinutes: input.halfDayThresholdMinutes,
      fullDayMinutes: input.fullDayMinutes,
      breakDurationMinutes: input.breakDurationMinutes,
      isDefault:  input.isDefault,
      isActive:   true,
    });
  }

  async bulkAssignShift(context: RequestContext, input: AssignShiftInput) {
    const shift = await this.shiftRepo.findById(context, input.shiftId);
    if (!shift) throw new AppError(
      "Shift not found",
      404
    );
    const result = await EmployeeModel.updateMany(
      {
        _id : { $in: input.employeeIds.map(id => new mongoose.Types.ObjectId(id))},
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      },
        {shiftId : shift._id}
    );
    return {
      message : `Shift  "${shift.name}" assigned to ${result.modifiedCount} employee(s)`,
      modifiedCount : result.modifiedCount,
    };
  }

  async getEmployeeShiftAssignments(context: RequestContext){
    const employees = await EmployeeModel.find({
      tenantId : new mongoose.Types.ObjectId(context.tenantId),
      isDeleted : false,
      isActive : true,
    })
    .populate("shiftId", "name code startTime endTime")
    .populate("departmentId", "name")
    .populate("branchId", "name")
    .select("employeeCode firstName lastName shiftId departmentId branchId")
    .lean();

    const defaultShift = await this.shiftRepo.findDefault(context);

    // Employees without an explicit shiftId fall back to the tenant default
    return employees.map((emp: any) => ({
      employeeId:   emp._id,
      employeeCode: emp.employeeCode,
      name:         `${emp.firstName} ${emp.lastName}`,
      department:   emp.departmentId?.name ?? "-",
      branch:       emp.branchId?.name ?? "-",
      shift:        emp.shiftId ?? defaultShift,
      isOverride:   !!emp.shiftId,
    }));

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