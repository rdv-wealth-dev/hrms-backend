import mongoose from "mongoose";
import { BaseRepository } from "../../../shared/database/base.repository";
import {
  PayrollGLConfigDocument,
  PayrollGLConfigModel,
} from "../models/payroll-gl-config.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class PayrollGLConfigRepository extends BaseRepository<PayrollGLConfigDocument> {
  constructor() {
    super(PayrollGLConfigModel);
  }

  async findByTenant(context: RequestContext) {
    let config = await PayrollGLConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!config) {
      // Auto-initialize with standard default Chart of Accounts if not yet customized
      config = await PayrollGLConfigModel.create({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        createdBy: new mongoose.Types.ObjectId(context.userId),
      });
    }

    return config;
  }

  async upsertConfig(context: RequestContext, data: Partial<PayrollGLConfigDocument>) {
    return PayrollGLConfigModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
      {
        $set: {
          ...data,
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          updatedBy: new mongoose.Types.ObjectId(context.userId),
        },
      },
      { upsert: true, new: true }
    );
  }
}
