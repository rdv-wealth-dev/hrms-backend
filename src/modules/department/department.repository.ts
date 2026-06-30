import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository"
import { DepartmentDocument, DepartmentModel } from "./department.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class DepartmentRepository
  extends BaseRepository<DepartmentDocument> {
  constructor() {
    super(DepartmentModel);
  }

  //Find by code within tenant
  async findByCode(
    context: RequestContext,
    code:    string
  ): Promise<DepartmentDocument | null> {
    return DepartmentModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      code:      code.toUpperCase(),
      isDeleted: false,
    });
  }

  //Find all by branch
  async findAllByBranch(
    context:  RequestContext,
    branchId: string
  ): Promise<DepartmentDocument[]> {
    return DepartmentModel.find({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(branchId),
      isDeleted: false,
      isActive:  true,
    }).sort({ name: 1 });
  }
}