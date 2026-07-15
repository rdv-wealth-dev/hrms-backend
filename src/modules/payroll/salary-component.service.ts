import mongoose from "mongoose";
import { SalaryComponentRepository } from "./salary-component.repository";
import { CreateSalaryComponentInput, UpdateSalaryComponentInput } from "./payroll.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { ComponentType, ComponentCalculationType } from "./salary-component.model";

export class SalaryComponentService {
  private repo = new SalaryComponentRepository();

  async create(context: RequestContext, input: CreateSalaryComponentInput) {
    const existing = await this.repo.findByCode(context, input.code);
    if (existing) throw new AppError(`Component code "${input.code}" already exists`, 409);

    return this.repo.create(context, {
      ...input,
      type:            input.type as ComponentType,
      calculationType: input.calculationType as ComponentCalculationType,
      tenantId:        new mongoose.Types.ObjectId(context.tenantId) as any,
      isStatutory:     false,
      isActive:        true,
    });
  }

  async list(context: RequestContext) {
    return this.repo.findAll(context, { isActive: true }, { pageNumber: 1, pageSize: 100 });
  }

  async getById(context: RequestContext, id: string) {
    const c = await this.repo.findById(context, id);
    if (!c) throw new AppError("Salary component not found", 404);
    return c;
  }

  async update(context: RequestContext, id: string, input: UpdateSalaryComponentInput) {
    const c = await this.repo.findById(context, id);
    if (!c) throw new AppError("Salary component not found", 404);
    if (c.isStatutory) throw new AppError("Statutory components cannot be modified", 403);
    return this.repo.updateById(context, id, input);
  }

  async delete(context: RequestContext, id: string) {
    const c = await this.repo.findById(context, id);
    if (!c) throw new AppError("Salary component not found", 404);
    if (c.isStatutory) throw new AppError("Statutory components cannot be deleted", 403);
    await this.repo.softDeleteById(context, id);
    return { message: "Salary component deleted successfully" };
  }
}