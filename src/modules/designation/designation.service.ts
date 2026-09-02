import mongoose from "mongoose";
import { DesignationRepository } from "./designation.repository";
import { CreateDesignationInput, UpdateDesignationInput, } from "./designation.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { PaginationOptions } from "../../shared/database/base.repository";
import { BranchRepository } from "../branch/branch.repository";
import { EmployeeModel } from "../employee/models/employee.model";
import { DesignationModel } from "./designation.model";

export class DesignationService {
  private desgRepo = new DesignationRepository();

  //Create
  async createDesignation(
    context: RequestContext,
    input: CreateDesignationInput
  ) {
    const existing = await this.desgRepo.findByCode(context, input.code);
    if (existing) {
      throw new AppError(
        `Designation code "${input.code}" already exists`,
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

    const designation = await this.desgRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: new mongoose.Types.ObjectId(branchId) as any,
      departmentId: new mongoose.Types.ObjectId(input.departmentId) as any,
      name: input.name,
      code: input.code,
      description: input.description ?? "",
      level: input.level ?? 1,
      isActive: true,
    });

    return designation;
  }

  //List all
  async listDesignations(
    context: RequestContext,
    pagination: PaginationOptions,
    filter: { departmentId?: string; branchId?: string } = {}
  ) {
    const queryFilter: Record<string, any> = { isActive: true };
    if (filter.departmentId && mongoose.Types.ObjectId.isValid(filter.departmentId)) {
      queryFilter.departmentId = new mongoose.Types.ObjectId(filter.departmentId);
    }
    if (filter.branchId && mongoose.Types.ObjectId.isValid(filter.branchId)) {
      queryFilter.branchId = new mongoose.Types.ObjectId(filter.branchId);
    }

    return this.desgRepo.findAll(
      { ...context, branchIds: [] },
      queryFilter,
      pagination,
      { sort: { departmentId: 1, level: 1, name: 1 } }
    );
  }


  //Get by ID
  async getDesignationById(
    context: RequestContext,
    id: string
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
    id: string,
    input: UpdateDesignationInput
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

  // Delete designation safely
  async deleteDesignation(
    context: RequestContext,
    id: string,
    options: { force?: boolean } = {}
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid designation ID format", 400);
    }

    const desg = await this.desgRepo.findById(context, id);
    if (!desg) {
      throw new AppError("Designation not found", 404);
    }

    const activeEmployeesCount = await EmployeeModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      designationId: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    });

    if (activeEmployeesCount > 0 && !options.force) {
      throw new AppError(
        `Cannot delete designation "${desg.name}" because ${activeEmployeesCount} active employee(s) are assigned to it. Please reassign them first or specify force=true.`,
        400
      );
    }

    await this.desgRepo.softDeleteById(context, id);
    return { message: "Designation deleted successfully", designationId: id };
  }

  // Delete all designations for a particular branch
  async deleteDesignationsByBranch(
    context: RequestContext,
    branchId: string,
    options: { force?: boolean } = {}
  ) {
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      throw new AppError("Invalid branch ID format", 400);
    }

    const desgs = await DesignationModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isDeleted: false,
    });

    if (desgs.length === 0) {
      return {
        message: "No active designations found for the specified branch",
        branchId,
        deletedCount: 0,
      };
    }

    const desgIds = desgs.map((d) => d._id);

    const activeEmployeesCount = await EmployeeModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      designationId: { $in: desgIds },
      isDeleted: false,
    });

    if (activeEmployeesCount > 0 && !options.force) {
      throw new AppError(
        `Cannot delete designations because ${activeEmployeesCount} active employee(s) are assigned to them in this branch. Please reassign them first or specify force=true.`,
        400
      );
    }

    const now = new Date();
    const updatedBy = context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined;

    const result = await DesignationModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        branchId: new mongoose.Types.ObjectId(branchId),
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          updatedBy,
          updatedAt: now,
        },
      }
    );

    return {
      message: "Branch designations deleted successfully",
      branchId,
      deletedCount: result.modifiedCount,
    };
  }

  // Delete all designations for a particular department
  async deleteDesignationsByDepartment(
    context: RequestContext,
    departmentId: string,
    options: { force?: boolean } = {}
  ) {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      throw new AppError("Invalid department ID format", 400);
    }

    const desgs = await DesignationModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      departmentId: new mongoose.Types.ObjectId(departmentId),
      isDeleted: false,
    });

    if (desgs.length === 0) {
      return {
        message: "No active designations found for the specified department",
        departmentId,
        deletedCount: 0,
      };
    }

    const desgIds = desgs.map((d) => d._id);

    const activeEmployeesCount = await EmployeeModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      designationId: { $in: desgIds },
      isDeleted: false,
    });

    if (activeEmployeesCount > 0 && !options.force) {
      throw new AppError(
        `Cannot delete designations because ${activeEmployeesCount} active employee(s) are assigned to them in this department. Please reassign them first or specify force=true.`,
        400
      );
    }

    const now = new Date();
    const updatedBy = context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined;

    const result = await DesignationModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        departmentId: new mongoose.Types.ObjectId(departmentId),
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          updatedBy,
          updatedAt: now,
        },
      }
    );

    return {
      message: "Department designations deleted successfully",
      departmentId,
      deletedCount: result.modifiedCount,
    };
  }
}