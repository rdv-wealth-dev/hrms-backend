import mongoose from "mongoose";
import { ShiftRotationPlanRepository } from "./shift-rotation-plan.repository";
import {
  CreateShiftRotationPlanInput,
  UpdateShiftRotationPlanInput,
  AssignRotationPlanInput,
} from "./shift-rotation-plan.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { EmployeeModel } from "../employee/employee.model";
import { normalizeToMidnight } from "./attendance.util";

export class ShiftRotationPlanService {
  private repo = new ShiftRotationPlanRepository();

  // ─── CREATE 

  async createPlan(context: RequestContext, input: CreateShiftRotationPlanInput) {
    // Ensure slot orders are 1..N sequential
    const sorted = [...input.slots].sort((a, b) => a.order - b.order);
    if (sorted[0].order !== 1 || sorted[sorted.length - 1].order !== sorted.length) {
      throw new AppError("Slot orders must be sequential starting from 1", 400);
    }

    return this.repo.create(context, {
      name:          input.name,
      description:   input.description,
      cycleDuration: input.cycleDuration,
      slots:         input.slots as any,
      isActive:      true,
    });
  }

  // ─── LIST 

  async listPlans(context: RequestContext) {
    return this.repo.findAll(context);
  }

  // ─── GET ONE 

  async getPlanById(context: RequestContext, id: string) {
    const plan = await this.repo.findById(context, id);
    if (!plan) throw new AppError("Rotation plan not found", 404);
    return plan;
  }

  // ─── UPDATE 

  async updatePlan(
    context: RequestContext,
    id: string,
    input: UpdateShiftRotationPlanInput
  ) {
    const plan = await this.repo.findById(context, id);
    if (!plan) throw new AppError("Rotation plan not found", 404);

    if (input.slots) {
      const sorted = [...input.slots].sort((a, b) => a.order - b.order);
      if (sorted[0].order !== 1 || sorted[sorted.length - 1].order !== sorted.length) {
        throw new AppError("Slot orders must be sequential starting from 1", 400);
      }
    }

    return this.repo.updateById(context, id, input as any);
  }

  // ─── DELETE 

  async deletePlan(context: RequestContext, id: string) {
    const plan = await this.repo.findById(context, id);
    if (!plan) throw new AppError("Rotation plan not found", 404);

    // Check if any employees are still on this plan
    const assignedCount = await EmployeeModel.countDocuments({
      tenantId:       new mongoose.Types.ObjectId(context.tenantId),
      rotationPlanId: new mongoose.Types.ObjectId(id),
      isDeleted:      false,
    });

    if (assignedCount > 0) {
      throw new AppError(
        `Cannot delete — ${assignedCount} employee(s) are currently assigned to this plan. Reassign or remove their rotation first.`,
        409
      );
    }

    await this.repo.softDeleteById(context, id);
    return { message: "Rotation plan deleted successfully" };
  }

  // ─── ASSIGN TO EMPLOYEES 

  async assignPlan(context: RequestContext, input: AssignRotationPlanInput) {
    // Verify plan exists if not being removed
    if (input.rotationPlanId) {
      const plan = await this.repo.findById(context, input.rotationPlanId);
      if (!plan) throw new AppError("Rotation plan not found", 404);
    }

    const startDate = input.rotationStartDate
      ? normalizeToMidnight(new Date(input.rotationStartDate))
      : normalizeToMidnight(new Date());

    const result = await EmployeeModel.updateMany(
      {
        _id: {
          $in: input.employeeIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        tenantId:  new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      },
      {
        $set: {
          rotationPlanId:    input.rotationPlanId
            ? new mongoose.Types.ObjectId(input.rotationPlanId)
            : null,
          rotationStartDate: input.rotationPlanId ? startDate : null,
          // When assigning a rotation plan, clear the fixed shiftId so the
          // schedule engine uses the rotation slot's shiftId instead
          ...(input.rotationPlanId ? { shiftId: null } : {}),
        },
      }
    );

    return {
      message: input.rotationPlanId
        ? `Rotation plan assigned to ${result.modifiedCount} employee(s)`
        : `Rotation plan removed from ${result.modifiedCount} employee(s)`,
      modifiedCount: result.modifiedCount,
    };
  }
}
