import mongoose from "mongoose";
import { BaseRepository } from "../../../shared/database/base.repository";
import {
  PayrollAdjustmentDocument,
  PayrollAdjustmentModel,
  AdjustmentStatus,
} from "../models/payroll-adjustment.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class PayrollAdjustmentRepository extends BaseRepository<PayrollAdjustmentDocument> {
  constructor() {
    super(PayrollAdjustmentModel);
  }

  async findApprovedForEmployeePeriod(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number
  ) {
    return PayrollAdjustmentModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: AdjustmentStatus.APPROVED,
      isDeleted: false,
      $or: [
        { month, year, frequency: "ONE_TIME" },
        {
          frequency: "RECURRING",
          $and: [
            {
              $or: [
                { recurringStartYear: { $lt: year } },
                { recurringStartYear: year, recurringStartMonth: { $lte: month } },
                { recurringStartYear: { $exists: false } },
              ],
            },
            {
              $or: [
                { recurringEndYear: { $gt: year } },
                { recurringEndYear: year, recurringEndMonth: { $gte: month } },
                { recurringEndYear: { $exists: false } },
                { recurringEndYear: null },
              ],
            },
          ],
        },
      ],
    }).lean();
  }

  async findByFilter(
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
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    if (filter.employeeId) {
      query.employeeId = new mongoose.Types.ObjectId(filter.employeeId);
    }
    if (filter.branchId) {
      query.branchId = new mongoose.Types.ObjectId(filter.branchId);
    }
    if (filter.year) {
      query.year = filter.year;
    }
    if (filter.month) {
      query.month = filter.month;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.type) {
      query.type = filter.type;
    }

    const [items, total] = await Promise.all([
      PayrollAdjustmentModel.find(query)
        .populate("employeeId", "employeeCode firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      PayrollAdjustmentModel.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async markProcessedForRun(
    tenantId: string,
    adjustmentIds: mongoose.Types.ObjectId[],
    payrollRunId: mongoose.Types.ObjectId
  ) {
    if (!adjustmentIds.length) return;
    await PayrollAdjustmentModel.updateMany(
      {
        _id: { $in: adjustmentIds },
        tenantId: new mongoose.Types.ObjectId(tenantId),
      },
      {
        status: AdjustmentStatus.PROCESSED,
        payrollRunId,
      }
    );
  }
}
