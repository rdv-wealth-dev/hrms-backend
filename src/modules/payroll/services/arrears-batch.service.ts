import mongoose from "mongoose";
import {
  ArrearsBatchModel,
  IArrearsBatch,
  ArrearsBatchStatus,
} from "../models/arrears-batch.model";
import {
  PayrollAdjustmentModel,
  AdjustmentType,
  AdjustmentCategory,
  AdjustmentFrequency,
  AdjustmentStatus,
} from "../models/payroll-adjustment.model";
import { EmployeeModel } from "../../employee/models/employee.model";
import { CounterModel } from "../../employee/utils/employee-counter.util";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import {
  CreateArrearsBatchInput,
  ProcessArrearsBatchInput,
  ArrearsBatchQueryInput,
} from "../dto/arrears-batch.dto";

export class ArrearsBatchService {
  /**
   * Generate atomic batch number: ARR-YYYYMM-0001
   */
  private async generateBatchNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sequenceKey = `arrears_batch_${yearMonth}`;

    const counter = await CounterModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId), sequenceName: sequenceKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

    const seq = String(counter.seq).padStart(4, "0");
    return `ARR-${yearMonth}-${seq}`;
  }

  /**
   * Create a new Arrears Batch
   */
  async createBatch(context: RequestContext, input: CreateArrearsBatchInput): Promise<IArrearsBatch> {
    const now = new Date();
    const currentYear = input.effectiveYear || now.getFullYear();
    const currentMonth = input.effectiveMonth || (now.getMonth() + 1);

    // Validate employee IDs and calculate totals
    const employeeIds = input.lines.map((l) => new mongoose.Types.ObjectId(l.employeeId));
    const employees = await EmployeeModel.find({
      _id: { $in: employeeIds },
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("_id branchId");

    const validEmpMap = new Map(employees.map((e) => [e._id.toString(), e]));

    let totalAmount = 0;
    const formattedLines: any[] = [];

    for (const line of input.lines) {
      if (!validEmpMap.has(line.employeeId)) {
        throw new AppError(`Employee ID '${line.employeeId}' not found in this organization`, 404);
      }
      totalAmount += line.amount;
      formattedLines.push({
        employeeId: new mongoose.Types.ObjectId(line.employeeId),
        amount: line.amount,
        remarks: line.remarks?.trim(),
      });
    }

    const batchNumber = await this.generateBatchNumber(context.tenantId);

    const batch = await ArrearsBatchModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      batchNumber,
      batchName: input.batchName.trim(),
      reason: input.reason.trim(),
      lines: formattedLines,
      totalAmount,
      totalEmployees: formattedLines.length,
      status: ArrearsBatchStatus.DRAFT,
      effectiveYear: currentYear,
      effectiveMonth: currentMonth,
      createdBy: new mongoose.Types.ObjectId(context.userId),
    });

    return batch;
  }

  /**
   * List Arrears Batches
   */
  async listBatches(context: RequestContext, query: ArrearsBatchQueryInput) {
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

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), "i");
      filter.$or = [{ batchNumber: searchRegex }, { batchName: searchRegex }, { reason: searchRegex }];
    }

    const [batches, totalRecords] = await Promise.all([
      ArrearsBatchModel.find(filter)
        .populate("createdBy", "name email")
        .populate("processedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ArrearsBatchModel.countDocuments(filter),
    ]);

    return {
      data: batches,
      totalRecords,
      pageNumber: page,
      pageSize: limit,
    };
  }

  /**
   * Get single batch by ID
   */
  async getBatchById(context: RequestContext, id: string): Promise<IArrearsBatch> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid arrears batch ID format", 400);
    }

    const batch = await ArrearsBatchModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("lines.employeeId", "firstName lastName employeeCode avatarUrl departmentId designationId")
      .populate("createdBy", "name email")
      .populate("processedBy", "name email");

    if (!batch) {
      throw new AppError("Arrears batch not found", 404);
    }

    return batch;
  }

  /**
   * Process Arrears Batch: Converts each line into an APPROVED ARREARS payroll adjustment
   */
  async processBatch(
    context: RequestContext,
    id: string,
    input?: ProcessArrearsBatchInput
  ): Promise<IArrearsBatch> {
    const batch = await this.getBatchById(context, id);

    if (batch.status !== ArrearsBatchStatus.DRAFT) {
      throw new AppError(`Cannot process batch in '${batch.status}' status`, 400);
    }

    const now = new Date();
    const targetYear = input?.targetYear || batch.effectiveYear || now.getFullYear();
    const targetMonth = input?.targetMonth || batch.effectiveMonth || (now.getMonth() + 1);

    // Fetch branch info for all employees in batch
    const empIds = batch.lines.map((l: any) => (l.employeeId?._id || l.employeeId));
    const employees = await EmployeeModel.find({
      _id: { $in: empIds },
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("_id branchId");

    const empBranchMap = new Map(employees.map((e) => [e._id.toString(), e.branchId]));

    const adjustmentsToInsert = batch.lines.map((line: any) => {
      const empIdStr = (line.employeeId?._id || line.employeeId).toString();
      const branchId = empBranchMap.get(empIdStr);

      return {
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        branchId: branchId ? new mongoose.Types.ObjectId(branchId.toString()) : (context.branchIds?.[0] ? new mongoose.Types.ObjectId(context.branchIds[0]) : new mongoose.Types.ObjectId()),
        employeeId: new mongoose.Types.ObjectId(empIdStr),
        type: AdjustmentType.EARNING,
        category: AdjustmentCategory.ARREARS,
        customLabel: `${batch.batchName} (${batch.batchNumber})`,
        amount: line.amount,
        month: targetMonth,
        year: targetYear,
        frequency: AdjustmentFrequency.ONE_TIME,
        status: AdjustmentStatus.APPROVED,
        isTaxable: true,
        affectsPfWages: false,
        affectsEsiWages: false,
        affectsPtWages: false,
        remarks: line.remarks || batch.reason,
        createdBy: new mongoose.Types.ObjectId(context.userId),
        approvedBy: new mongoose.Types.ObjectId(context.userId),
        approvedAt: new Date(),
      };
    });

    // Bulk insert adjustments
    await PayrollAdjustmentModel.insertMany(adjustmentsToInsert);

    batch.status = ArrearsBatchStatus.PROCESSED;
    batch.processedBy = new mongoose.Types.ObjectId(context.userId);
    batch.processedAt = new Date();
    batch.effectiveYear = targetYear;
    batch.effectiveMonth = targetMonth;

    await batch.save();
    return batch;
  }
}
