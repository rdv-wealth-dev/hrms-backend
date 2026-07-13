import mongoose from "mongoose";
import { LeaveRequestDocument, LeaveRequestModel } from "./leave-request.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class LeaveRequestRepository {

  async create(data: Partial<LeaveRequestDocument>): Promise<LeaveRequestDocument> {
    return new LeaveRequestModel(data).save();
  }

  async save(doc: LeaveRequestDocument): Promise<LeaveRequestDocument> {
    return doc.save();
  }

  async findById(context: RequestContext, id: string): Promise<LeaveRequestDocument | null> {
    return LeaveRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("employeeId", "employeeCode firstName lastName")
      .populate("leaveTypeId", "name code isPaid");
  }

  async findForEmployee(
    context: RequestContext,
    employeeId: string,
    page: number,
    pageSize: number
  ) {
    const query = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    };

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      LeaveRequestModel.find(query)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(safe)
        .populate("employeeId", "employeeCode firstName lastName")
        .populate("leaveTypeId", "name code isPaid")
        .lean(),
      LeaveRequestModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

  // Requests currently awaiting action from a specific role, for the pending queue
  async findPendingForApproverRole(
    context: RequestContext,
    approverRole: string,
    page: number,
    pageSize: number
  ) {
    const query: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      status: "PENDING",
      isDeleted: false,
      approvals: {
        $elemMatch: {
          status: "PENDING",
          approverRole,
        },
      },
    };

    if (context.branchIds && context.branchIds.length > 0) {
      query.branchId = {
        $in: context.branchIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      LeaveRequestModel.find(query)
        .sort({ appliedAt: 1 })
        .skip(skip)
        .limit(safe)
        .populate("employeeId", "employeeCode firstName lastName")
        .populate("leaveTypeId", "name code")
        .lean(),
      LeaveRequestModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

  async findReport(
    context: RequestContext,
    filters: Record<string, unknown>,
    page: number,
    pageSize: number
  ) {
    const query: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      ...filters,
    };

    if (context.branchIds && context.branchIds.length > 0 && !filters.branchId) {
      query.branchId = {
        $in: context.branchIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      LeaveRequestModel.find(query)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(safe)
        .populate("employeeId", "employeeCode firstName lastName")
        .populate("leaveTypeId", "name code")
        .lean(),
      LeaveRequestModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }
}