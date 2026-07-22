import mongoose from "mongoose";
import { DesignationRepository } from "./designation.repository";
import { CreateDesignationInput, UpdateDesignationInput, } from "./designation.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { PaginationOptions } from "../../repositories/base.repository"

export class DesignationService {
  private desgRepo = new DesignationRepository();

  //Create
  async createDesignation(
    context: RequestContext,
    input:   CreateDesignationInput
  ) {
    const existing = await this.desgRepo.findByCode(context, input.code);
    if (existing) {
      throw new AppError(
        `Designation code "${input.code}" already exists`,
        409
      );
    }

    const designation = await this.desgRepo.create(context, {
      tenantId:     new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:     new mongoose.Types.ObjectId(input.branchId)   as any,
      departmentId: new mongoose.Types.ObjectId(input.departmentId) as any,
      name:         input.name,
      code:         input.code,
      description:  input.description ?? "",
      level:        input.level ?? 1,
      isActive:     true,
    });

    return designation;
  }

  //List all
  async listDesignations(
    context:    RequestContext,
    pagination: PaginationOptions
  ) {
    // Designations are org-level master data — NOT branch-scoped.
    return this.desgRepo.findAll(
      { ...context, branchIds: [] },
      { isActive: true },
      pagination,
      { sort: { departmentId: 1, level: 1, name: 1 } }
    );
  }

  //Get by ID
  async getDesignationById(
    context: RequestContext,
    id:      string
  ) {
    const desg = await this.desgRepo.findById(context, id);
    if (!desg) {
      throw new AppError("Designation not found", 404);
    }
    return desg;
  }

  //Update
  async updateDesignation(
    context: RequestContext,
    id:      string,
    input:   UpdateDesignationInput
  ) {
    const desg = await this.desgRepo.findById(context, id);
    if (!desg) {
      throw new AppError("Designation not found", 404);
    }

    if (input.code && input.code !== desg.code) {
      const existing = await this.desgRepo.findByCode(context, input.code);
      if (existing) {
        throw new AppError(
          `Designation code "${input.code}" already exists`,
          409
        );
      }
    }

    const updated = await this.desgRepo.updateById(context, id, input);
    return updated;
  }

  //Delete
  async deleteDesignation(
    context: RequestContext,
    id:      string
  ) {
    const desg = await this.desgRepo.findById(context, id);
    if (!desg) {
      throw new AppError("Designation not found", 404);
    }

    await this.desgRepo.softDeleteById(context, id);
    return { message: "Designation deleted successfully" };
  }
}