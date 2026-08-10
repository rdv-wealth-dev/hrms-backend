import mongoose from "mongoose";
import { PayrollAdjustmentRepository } from "../repositories/payroll-adjustment.repository";
import {
  AdjustmentStatus,
  AdjustmentType,
  AdjustmentCategory,
  AdjustmentFrequency,
} from "../models/payroll-adjustment.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeModel } from "../../employee/models/employee.model";

export interface CreateAdjustmentInput {
  employeeId: string;
  type: AdjustmentType;
  category: AdjustmentCategory;
  customLabel: string;
  amount: number;
  month: number;
  year: number;
  frequency?: AdjustmentFrequency;
  recurringStartMonth?: number;
  recurringStartYear?: number;
  recurringEndMonth?: number;
  recurringEndYear?: number;
  isTaxable?: boolean;
  affectsPfWages?: boolean;
  affectsEsiWages?: boolean;
  notes?: string;
}

export interface BulkCreateAdjustmentInput {
  adjustments: CreateAdjustmentInput[];
}

export class PayrollAdjustmentService {
  private repo = new PayrollAdjustmentRepository();

  async create(context: RequestContext, input: CreateAdjustmentInput) {
    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(input.employeeId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("branchId");

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    return this.repo.create(context, {
      employeeId: new mongoose.Types.ObjectId(input.employeeId) as any,
      branchId: employee.branchId as any,
      type: input.type,
      category: input.category,
      customLabel: input.customLabel,
      amount: input.amount,
      month: input.month,
      year: input.year,
      frequency: input.frequency || AdjustmentFrequency.ONE_TIME,
      recurringStartMonth: input.recurringStartMonth,
      recurringStartYear: input.recurringStartYear,
      recurringEndMonth: input.recurringEndMonth,
      recurringEndYear: input.recurringEndYear,
      isTaxable: input.isTaxable !== undefined ? input.isTaxable : input.type === AdjustmentType.EARNING,
      affectsPfWages: !!input.affectsPfWages,
      affectsEsiWages: !!input.affectsEsiWages,
      status: AdjustmentStatus.PENDING,
      notes: input.notes,
    });
  }

  async bulkCreate(context: RequestContext, input: BulkCreateAdjustmentInput) {
    const results = [];
    const errors = [];

    for (let i = 0; i < input.adjustments.length; i++) {
      const item = input.adjustments[i];
      try {
        const created = await this.create(context, item);
        results.push(created);
      } catch (err: any) {
        errors.push({ index: i, employeeId: item.employeeId, error: err.message });
      }
    }

    return {
      successCount: results.length,
      failureCount: errors.length,
      created: results,
      errors,
    };
  }

  async approve(context: RequestContext, id: string) {
    const adj = await this.repo.findById(context, id);
    if (!adj) throw new AppError("Adjustment not found", 404);

    if (adj.status !== AdjustmentStatus.PENDING) {
      throw new AppError(`Cannot approve adjustment with status ${adj.status}`, 400);
    }

    return this.repo.updateById(context, id, {
      status: AdjustmentStatus.APPROVED,
      approvedBy: new mongoose.Types.ObjectId(context.userId),
      approvedAt: new Date(),
    });
  }

  async reject(context: RequestContext, id: string, reason: string) {
    const adj = await this.repo.findById(context, id);
    if (!adj) throw new AppError("Adjustment not found", 404);

    if (adj.status !== AdjustmentStatus.PENDING) {
      throw new AppError(`Cannot reject adjustment with status ${adj.status}`, 400);
    }

    return this.repo.updateById(context, id, {
      status: AdjustmentStatus.REJECTED,
      rejectionReason: reason,
    });
  }

  async list(
    context: RequestContext,
    filter: {
      employeeId?: string;
      branchId?: string;
      year?: number;
      month?: number;
      status?: string;
      type?: string;
    },
    page: number = 1,
    pageSize: number = 20
  ) {
    return this.repo.findByFilter(context, filter, page, pageSize);
  }

  async getById(context: RequestContext, id: string) {
    const adj = await this.repo.findById(context, id);
    if (!adj) throw new AppError("Adjustment not found", 404);
    return adj;
  }

  async delete(context: RequestContext, id: string) {
    const adj = await this.repo.findById(context, id);
    if (!adj) throw new AppError("Adjustment not found", 404);

    if (adj.status === AdjustmentStatus.PROCESSED) {
      throw new AppError("Cannot delete an adjustment that has already been processed in a payroll run", 400);
    }

    return this.repo.softDeleteById(context, id);
  }
}
