import mongoose from "mongoose";
import {
  ReimbursementModel,
  IReimbursement,
  ReimbursementStatus,
  ReimbursementCategory,
} from "../models/reimbursement.model";
import { EmployeeModel } from "../../employee/models/employee.model";
import { UserModel } from "../../user/user.model";
import { CounterModel } from "../../employee/utils/employee-counter.util";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import {
  CreateReimbursementInput,
  UpdateReimbursementInput,
  ApproveReimbursementInput,
  RejectReimbursementInput,
  ReimbursementQueryInput,
} from "../dto/reimbursement.dto";

export class ReimbursementService {
  /**
   * Generates a unique atomic claim reference number: CLM-YYYYMM-0001
   */
  private async generateClaimNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sequenceKey = `reimbursement_${yearMonth}`;

    const counter = await CounterModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId), sequenceName: sequenceKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

    const seq = String(counter.seq).padStart(4, "0");
    return `CLM-${yearMonth}-${seq}`;
  }

  /**
   * Submit a new Reimbursement Claim
   */
  async createClaim(context: RequestContext, input: CreateReimbursementInput): Promise<IReimbursement> {
    let employeeObjectId: mongoose.Types.ObjectId;

    if (input.employeeId && mongoose.Types.ObjectId.isValid(input.employeeId)) {
      employeeObjectId = new mongoose.Types.ObjectId(input.employeeId);
    } else if (context.employeeId && mongoose.Types.ObjectId.isValid(context.employeeId)) {
      employeeObjectId = new mongoose.Types.ObjectId(context.employeeId);
    } else {
      const user = await UserModel.findById(context.userId).select("employeeId");
      if (!user?.employeeId) {
        throw new AppError("No associated employee profile found for submitting reimbursement claims", 400);
      }
      employeeObjectId = user.employeeId as mongoose.Types.ObjectId;
    }

    const employee = await EmployeeModel.findOne({
      _id: employeeObjectId,
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!employee) {
      throw new AppError("Employee not found in this organization", 404);
    }

    const claimNumber = await this.generateClaimNumber(context.tenantId);

    const claim = await ReimbursementModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employeeObjectId,
      claimNumber,
      category: input.category || ReimbursementCategory.GENERAL,
      title: input.title.trim(),
      description: input.description?.trim(),
      amount: input.amount,
      approvedAmount: input.amount,
      expenseDate: new Date(input.expenseDate),
      receiptUrl: input.receiptUrl || undefined,
      receiptFileName: input.receiptFileName || undefined,
      status: ReimbursementStatus.PENDING,
      remarks: input.remarks?.trim(),
    });

    return claim;
  }

  /**
   * List Reimbursement Claims (Admin / HR)
   */
  async listClaims(context: RequestContext, query: ReimbursementQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.employeeId && mongoose.Types.ObjectId.isValid(query.employeeId)) {
      filter.employeeId = new mongoose.Types.ObjectId(query.employeeId);
    }

    if (query.startDate && query.endDate) {
      filter.expenseDate = {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      };
    }

    // Keyword search on title or claimNumber
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), "i");
      filter.$or = [{ claimNumber: searchRegex }, { title: searchRegex }];
    }

    const [claims, totalRecords] = await Promise.all([
      ReimbursementModel.find(filter)
        .populate("employeeId", "firstName lastName employeeCode avatarUrl departmentId designationId")
        .populate("approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReimbursementModel.countDocuments(filter),
    ]);

    return {
      data: claims,
      totalRecords,
      pageNumber: page,
      pageSize: limit,
    };
  }

  /**
   * List Personal Reimbursements (Logged-in Employee)
   */
  async getMyClaims(context: RequestContext, query: ReimbursementQueryInput) {
    let employeeObjectId: mongoose.Types.ObjectId | undefined;

    if (context.employeeId && mongoose.Types.ObjectId.isValid(context.employeeId)) {
      employeeObjectId = new mongoose.Types.ObjectId(context.employeeId);
    } else {
      const user = await UserModel.findById(context.userId).select("employeeId");
      if (user?.employeeId) {
        employeeObjectId = user.employeeId as mongoose.Types.ObjectId;
      }
    }

    if (!employeeObjectId) {
      return {
        data: [],
        totalRecords: 0,
        pageNumber: 1,
        pageSize: 20,
      };
    }

    return this.listClaims(context, {
      ...query,
      employeeId: employeeObjectId.toString(),
    });
  }

  /**
   * Get single claim by ID
   */
  async getClaimById(context: RequestContext, id: string): Promise<IReimbursement> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid claim ID format", 400);
    }

    const claim = await ReimbursementModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("employeeId", "firstName lastName employeeCode avatarUrl departmentId designationId")
      .populate("approvedBy", "name email");

    if (!claim) {
      throw new AppError("Reimbursement claim not found", 404);
    }

    return claim;
  }

  /**
   * Approve Reimbursement Claim
   */
  async approveClaim(
    context: RequestContext,
    id: string,
    input: ApproveReimbursementInput
  ): Promise<IReimbursement> {
    const claim = await this.getClaimById(context, id);

    if (claim.status !== ReimbursementStatus.PENDING) {
      throw new AppError(`Cannot approve claim in '${claim.status}' state`, 400);
    }

    claim.status = ReimbursementStatus.APPROVED;
    claim.approvedAmount = input.approvedAmount ?? claim.amount;
    claim.approvedBy = new mongoose.Types.ObjectId(context.userId);
    claim.approvedAt = new Date();
    if (input.remarks) {
      claim.remarks = input.remarks.trim();
    }

    await claim.save();
    return claim;
  }

  /**
   * Reject Reimbursement Claim
   */
  async rejectClaim(
    context: RequestContext,
    id: string,
    input: RejectReimbursementInput
  ): Promise<IReimbursement> {
    const claim = await this.getClaimById(context, id);

    if (claim.status !== ReimbursementStatus.PENDING) {
      throw new AppError(`Cannot reject claim in '${claim.status}' state`, 400);
    }

    claim.status = ReimbursementStatus.REJECTED;
    claim.rejectionReason = input.reason.trim();
    claim.approvedBy = new mongoose.Types.ObjectId(context.userId);
    claim.approvedAt = new Date();

    await claim.save();
    return claim;
  }

  /**
   * Cancel Claim (Employee self-action)
   */
  async cancelClaim(context: RequestContext, id: string): Promise<IReimbursement> {
    const claim = await this.getClaimById(context, id);

    if (claim.status !== ReimbursementStatus.PENDING) {
      throw new AppError(`Only PENDING claims can be cancelled`, 400);
    }

    claim.status = ReimbursementStatus.CANCELLED;
    await claim.save();
    return claim;
  }

  /**
   * Helper for Payroll Engine: Get all approved, unpaid reimbursements for an employee
   */
  async getApprovedUnpaidReimbursements(
    tenantId: string,
    employeeId: string
  ): Promise<IReimbursement[]> {
    return ReimbursementModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: ReimbursementStatus.APPROVED,
      isDeleted: false,
    }).lean() as any;
  }

  /**
   * Helper for Payroll Engine: Mark approved reimbursements as PAID upon payroll finalization
   */
  async markReimbursementsPaid(
    tenantId: string,
    claimIds: mongoose.Types.ObjectId[],
    payrollRunId: mongoose.Types.ObjectId,
    paidMonth: string
  ): Promise<void> {
    if (!claimIds || claimIds.length === 0) return;

    await ReimbursementModel.updateMany(
      {
        _id: { $in: claimIds },
        tenantId: new mongoose.Types.ObjectId(tenantId),
      },
      {
        $set: {
          status: ReimbursementStatus.PAID,
          payrollRunId,
          paidMonth,
        },
      }
    );
  }
}
