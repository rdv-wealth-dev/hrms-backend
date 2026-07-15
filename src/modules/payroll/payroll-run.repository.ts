import mongoose from "mongoose";
import { PayrollRunDocument, PayrollRunModel } from "./payroll-run.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class PayrollRunRepository {

  async create(data: Partial<PayrollRunDocument>) {
    return new PayrollRunModel(data).save();
  }

  async save(doc: PayrollRunDocument) {
    return doc.save();
  }

  async findById(context: RequestContext, id: string) {
    return PayrollRunModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }

  async findByMonthYear(context: RequestContext, year: number, month: number) {
    return PayrollRunModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(context.branchIds[0] ?? ""),
      year, month,
      isDeleted: false,
    });
  }

  async findAll(context: RequestContext, page: number, pageSize: number) {
    const query = {
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };
    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);
    const [data, totalRecords] = await Promise.all([
      PayrollRunModel.find(query).sort({ year: -1, month: -1 }).skip(skip).limit(safe).lean(),
      PayrollRunModel.countDocuments(query),
    ]);
    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }
}