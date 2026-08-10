import mongoose from "mongoose";
import { PayrollRunDocument, PayrollRunModel } from "../models/payroll-run.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

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

  async findByMonthYear(
    context: RequestContext,
    branchId: string,
    year: number,
    month: number
  ) {
    return PayrollRunModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(branchId),
      year,
      month,
      isDeleted: false,
    });
  }

  async findAll(
    context: RequestContext,
    page: number,
    pageSize: number,
    filter?: { branchId?: string; year?: number; month?: number; status?: string }
  ) {
    const query: any = {
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    const targetBranchId = filter?.branchId || (context.branchIds.length === 1 ? context.branchIds[0] : undefined);
    if (targetBranchId) {
      query.branchId = new mongoose.Types.ObjectId(targetBranchId);
    }
    if (filter?.year) query.year = filter.year;
    if (filter?.month) query.month = filter.month;
    if (filter?.status) query.status = filter.status;

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);
    const [data, totalRecords] = await Promise.all([
      PayrollRunModel.find(query).sort({ year: -1, month: -1, createdAt: -1 }).skip(skip).limit(safe).lean(),
      PayrollRunModel.countDocuments(query),
    ]);
    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }
}