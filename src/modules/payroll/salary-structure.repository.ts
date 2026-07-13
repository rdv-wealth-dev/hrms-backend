import mongoose from "mongoose";
import { SalaryStructureDocument, SalaryStructureModel } from "./salary-structure.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class SalaryStructureRepository {

  async create(data: Partial<SalaryStructureDocument>) {
    return new SalaryStructureModel(data).save();
  }

  async save(doc: SalaryStructureDocument) {
    return doc.save();
  }

  async findActiveForEmployee(context: RequestContext, employeeId: string) {
    return SalaryStructureModel.findOne({
      tenantId:   new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      effectiveTo: null,
      isDeleted:  false,
    });
  }

  async findActiveAsOfDate(context: RequestContext, employeeId: string, date: Date) {
    return SalaryStructureModel.findOne({
      tenantId:      new mongoose.Types.ObjectId(context.tenantId),
      employeeId:    new mongoose.Types.ObjectId(employeeId),
      effectiveFrom: { $lte: date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
      isDeleted:     false,
    });
  }

  async findById(context: RequestContext, id: string) {
    return SalaryStructureModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }
}