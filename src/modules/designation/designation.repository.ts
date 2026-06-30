import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository"
import { DesignationDocument, DesignationModel } from "./designation.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class DesignationRepository
  extends BaseRepository<DesignationDocument> {
  constructor() {
    super(DesignationModel);
  }

  // Find by code within tenant 
  async findByCode(
    context: RequestContext,
    code:    string
  ): Promise<DesignationDocument | null> {
    return DesignationModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      code:      code.toUpperCase(),
      isDeleted: false,
    });
  }

  //Find all by department
  async findAllByDepartment(
    context:      RequestContext,
    departmentId: string
  ): Promise<DesignationDocument[]> {
    return DesignationModel.find({
      tenantId:     new mongoose.Types.ObjectId(context.tenantId),
      departmentId: new mongoose.Types.ObjectId(departmentId),
      isDeleted:    false,
      isActive:     true,
    }).sort({ level: 1, name: 1 });
  }
}