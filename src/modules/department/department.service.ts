import mongoose from "mongoose";
import { DepartmentRepository } from "./department.repository";
import { CreateDepartmentInput, UpdateDepartmentInput, } from "./department.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { PaginationOptions,} from "../../repositories/base.repository"

export class DepartmentService {
  private deptRepo = new DepartmentRepository();

  //Create
  async createDepartment(
    context: RequestContext,
    input:   CreateDepartmentInput
  ) {
    // Check code uniqueness within tenant
    const existing = await this.deptRepo.findByCode(context, input.code);
    if (existing) {
      throw new AppError(
        `Department code "${input.code}" already exists`,
        409
      );
    }

    const department = await this.deptRepo.create(context, {
      tenantId:    new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:    new mongoose.Types.ObjectId(input.branchId)   as any,
      name:        input.name,
      code:        input.code,
      description: input.description ?? "",
      parentId:    input.parentId
        ? new mongoose.Types.ObjectId(input.parentId) as any
        : undefined,
      isActive:    true,
    });

    return department;
  }

  // List all
  async listDepartments(
    context:    RequestContext,
    pagination: PaginationOptions
  ) {
    return this.deptRepo.findAll(
      context,
      { isActive: true },
      pagination,
      { sort: { name: 1 } }
    );
  }

  //Get by ID
  async getDepartmentById(
    context: RequestContext,
    id:      string
  ) {
    const dept = await this.deptRepo.findById(context, id);
    if (!dept) {
      throw new AppError("Department not found", 404);
    }
    return dept;
  }

  //Update
  async updateDepartment(
    context: RequestContext,
    id:      string,
    input:   UpdateDepartmentInput
  ) {
    const dept = await this.deptRepo.findById(context, id);
    if (!dept) {
      throw new AppError("Department not found", 404);
    }

    // Check code uniqueness if changing code
    if (input.code && input.code !== dept.code) {
      const existing = await this.deptRepo.findByCode(context, input.code);
      if (existing) {
        throw new AppError(
          `Department code "${input.code}" already exists`,
          409
        );
      }
    }

    const updated = await this.deptRepo.updateById(context, id, input);
    return updated;
  }

  //Delete
  async deleteDepartment(
    context: RequestContext,
    id:      string
  ) {
    const dept = await this.deptRepo.findById(context, id);
    if (!dept) {
      throw new AppError("Department not found", 404);
    }

    await this.deptRepo.softDeleteById(context, id);
    return { message: "Department deleted successfully" };
  }
}