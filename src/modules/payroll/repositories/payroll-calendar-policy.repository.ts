import mongoose from "mongoose";
import { BaseRepository } from "../../../shared/database/base.repository";
import {
  PayrollCalendarPolicyDocument,
  PayrollCalendarPolicyModel,
} from "../models/payroll-calendar-policy.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class PayrollCalendarPolicyRepository extends BaseRepository<PayrollCalendarPolicyDocument> {
  constructor() {
    super(PayrollCalendarPolicyModel);
  }

  async findByTenant(context: RequestContext): Promise<PayrollCalendarPolicyDocument | null> {
    return PayrollCalendarPolicyModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }

  async findByTenantId(tenantId: string): Promise<PayrollCalendarPolicyDocument | null> {
    return PayrollCalendarPolicyModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });
  }

  async upsertPolicy(
    context: RequestContext,
    data: Partial<PayrollCalendarPolicyDocument>
  ): Promise<PayrollCalendarPolicyDocument> {
    const updated = await PayrollCalendarPolicyModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
      {
        $set: {
          ...data,
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          updatedBy: new mongoose.Types.ObjectId(context.userId),
        },
        $setOnInsert: {
          createdBy: new mongoose.Types.ObjectId(context.userId),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return updated as PayrollCalendarPolicyDocument;
  }
}
