import mongoose from "mongoose";
import { LeaveRequestDocument, LeaveRequestModel } from "./leave-request.model";
import { RequestContext } from "../../../../shared/types/request-context.interface";

export class LeaveRequestRepository {

  async create(data: Partial<LeaveRequestDocument>): Promise<LeaveRequestDocument> {
    return new LeaveRequestModel(data).save();
  }

  async save(doc: LeaveRequestDocument): Promise<LeaveRequestDocument> {
    return doc.save();
  }

  async findById(context: RequestContext, id: string): Promise<LeaveRequestDocument | null> {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return LeaveRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }

  async findPopulatedById(context: RequestContext, id: string): Promise<LeaveRequestDocument | null> {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return LeaveRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("employeeId", "employeeCode firstName lastName avatarUrl profilePicture")
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
        .populate("employeeId", "employeeCode firstName lastName avatarUrl profilePicture")
        .populate("leaveTypeId", "name code isPaid")
        .lean(),
      LeaveRequestModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

  // Requests currently awaiting action from a specific role/approver, for the pending queue
  async findPendingForApproverRole(
    context: RequestContext,
    approverRole: string,
    page: number,
    pageSize: number
  ) {
    const isOrgAdmin = context.role === "ORG_ADMIN" || context.role === "SUPER_ADMIN" || (context as any).isOrgAdmin;
    const userOId = new mongoose.Types.ObjectId(context.userId);
    const empOId = context.employeeId ? new mongoose.Types.ObjectId(context.employeeId) : null;

    let approverCondition: any;

    if (isOrgAdmin) {
      // Org Admin has overarching authority over pending requests awaiting action at their current level
      approverCondition = true;
    } else {
      const orList: any[] = [
        // 1. Logged in user is explicitly assigned as approverId on the active step
        { $eq: ["$$step.approverId", userOId] },
      ];
      if (empOId) {
        orList.push({ $eq: ["$$step.approverId", empOId] });
      }

      // 2. Role-based fallback: if approverId is not specified, or matches user's active role
      orList.push({
        $and: [
          {
            $or: [
              { $eq: ["$$step.approverId", null] },
              { $not: ["$$step.approverId"] },
            ],
          },
          { $eq: ["$$step.approverRole", context.role] },
        ],
      });

      approverCondition = { $or: orList };
    }

    const query: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      status: "PENDING",
      isDeleted: false,
      $expr: {
        $gt: [
          {
            $size: {
              $filter: {
                input: "$approvals",
                as: "step",
                cond: {
                  $and: [
                    { $eq: ["$$step.level", "$currentApprovalLevel"] },
                    { $eq: ["$$step.status", "PENDING"] },
                    approverCondition,
                  ],
                },
              },
            },
          },
          0,
        ],
      },
    };

    if (!isOrgAdmin && context.branchIds && context.branchIds.length > 0) {
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
        .populate("employeeId", "employeeCode firstName lastName avatarUrl profilePicture branchId departmentId")
        .populate("leaveTypeId", "name code isPaid")
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

    if (context.role !== "ORG_ADMIN" && context.role !== "SUPER_ADMIN" && context.branchIds && context.branchIds.length > 0 && !filters.branchId) {
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
        .populate("employeeId", "employeeCode firstName lastName avatarUrl profilePicture")
        .populate("leaveTypeId", "name code")
        .lean(),
      LeaveRequestModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }
}