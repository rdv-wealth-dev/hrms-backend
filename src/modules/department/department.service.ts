import mongoose from "mongoose";
import { DepartmentRepository } from "./department.repository";
import { CreateDepartmentInput, UpdateDepartmentInput, } from "./department.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { PaginationOptions,} from "../../shared/database/base.repository";
import { BranchRepository } from "../branch/branch.repository";
import { seedDepartments } from "../../database/seeds/department.seed";
import { seedDesignations } from "../../database/seeds/designation.seed";


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

    let branchId = input.branchId;
    if (!branchId) {
      const branchRepo = new BranchRepository();
      const headOffice = await branchRepo.findHeadOffice(context.tenantId);
      if (!headOffice) {
        throw new AppError(
          "No head office branch found for organization. Please complete onboarding first.",
          400
        );
      }
      branchId = headOffice._id.toString();
    }

    const department = await this.deptRepo.create(context, {
      tenantId:    new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:    new mongoose.Types.ObjectId(branchId)   as any,
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
    // Departments are org-level master data — NOT branch-scoped.
    // We deliberately skip the base repo's branchId filter here so that
    // all departments across all branches are visible to every user.
    return this.deptRepo.findAll(
      { ...context, branchIds: [] },   // clear branchIds so base filter doesn't scope it
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

  // Seed default departments & designations
  async seedMasterData(context: RequestContext, branchId?: string) {
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const branchRepo = new BranchRepository();
      const headOffice = await branchRepo.findHeadOffice(context.tenantId);
      if (headOffice) {
        targetBranchId = headOffice._id.toString();
      } else {
        const branches = await branchRepo.findAllByTenant(context.tenantId);
        if (branches.length > 0) {
          targetBranchId = branches[0]._id.toString();
        } else {
          throw new AppError("No branch found for organization. Please create a branch first.", 400);
        }
      }
    }

    const deptMap = await seedDepartments(context.tenantId, targetBranchId);
    await seedDesignations(context.tenantId, targetBranchId, deptMap);

    return {
      message: "Standard departments and designations seeded successfully",
      branchId: targetBranchId,
      departmentsSeeded: deptMap.size,
    };
  }
}