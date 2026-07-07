import mongoose from "mongoose";
import { LeaveBalanceDocument, LeaveBalanceModel } from "./leave-balance.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class LeaveBalanceRepository {

  async findOrNull(
    context: RequestContext,
    employeeId: string,
    leaveTypeId: string,
    year: number
  ): Promise<LeaveBalanceDocument | null> {
    return LeaveBalanceModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      leaveTypeId: new mongoose.Types.ObjectId(leaveTypeId),
      year,
      isDeleted: false,
    });
  }

  async create(data: Partial<LeaveBalanceDocument>): Promise<LeaveBalanceDocument> {
    return new LeaveBalanceModel(data).save();
  }

  async save(doc: LeaveBalanceDocument): Promise<LeaveBalanceDocument> {
    return doc.save();
  }

  async findAllForEmployee(
    context: RequestContext,
    employeeId: string,
    year: number
  ): Promise<LeaveBalanceDocument[]> {
    return LeaveBalanceModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      year,
      isDeleted: false,
    }).populate("leaveTypeId", "name code isPaid");
  }
}