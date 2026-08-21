import { BaseRepository } from "../../../shared/database/base.repository";
import {
  PayslipTemplateDocument,
  PayslipTemplateModel,
} from "../models/payslip-template.model";

export class PayslipTemplateRepository extends BaseRepository<PayslipTemplateDocument> {
  constructor() {
    super(PayslipTemplateModel);
  }

  async findDefault(tenantId: string): Promise<PayslipTemplateDocument | null> {
    return this.model.findOne({ tenantId, isCompanyDefault: true, isActive: true });
  }

  async findByTemplateCode(
    tenantId: string,
    templateCode: string
  ): Promise<PayslipTemplateDocument | null> {
    return this.model.findOne({ tenantId, templateCode: templateCode.toUpperCase(), isActive: true });
  }

  async findActive(tenantId: string): Promise<PayslipTemplateDocument[]> {
    return this.model.find({ tenantId, isActive: true });
  }
}
