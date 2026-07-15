import mongoose from "mongoose";
import { PayslipDocument, PayslipModel } from "./payslip.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class PayslipRepository {

  async create(data: Partial<PayslipDocument>) {
    return new PayslipModel(data).save();
  }

  async findByRun(context: RequestContext, payrollRunId: string) {
    return PayslipModel.find({
      tenantId:     new mongoose.Types.ObjectId(context.tenantId),
      payrollRunId: new mongoose.Types.ObjectId(payrollRunId),
      isDeleted:    false,
    }).populate("employeeId", "employeeCode firstName lastName");
  }

  async findForEmployee(context: RequestContext, employeeId: string, page: number, pageSize: number) {
    const query = {
      tenantId:   new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted:  false,
    };
    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      PayslipModel.find(query).sort({ year: -1, month: -1 }).skip(skip).limit(safe).lean(),
      PayslipModel.countDocuments(query),
    ]);
    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

  async findById(context: RequestContext, id: string) {
    return PayslipModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }

  async existsForRunAndEmployee(context: RequestContext, payrollRunId: string, employeeId: string) {
    const doc = await PayslipModel.findOne({
      tenantId:     new mongoose.Types.ObjectId(context.tenantId),
      payrollRunId: new mongoose.Types.ObjectId(payrollRunId),
      employeeId:   new mongoose.Types.ObjectId(employeeId),
    }).select("_id");
    return doc !== null;
  }
}