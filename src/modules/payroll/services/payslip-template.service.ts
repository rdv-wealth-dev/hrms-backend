import { PayslipTemplateRepository } from "../repositories/payslip-template.repository";
import { PayslipTemplateDocument, PayslipTemplateModel } from "../models/payslip-template.model";
import { NotFoundError } from "../../../shared/errors/app.error";

export class PayslipTemplateService {
  private repo: PayslipTemplateRepository;

  constructor() {
    this.repo = new PayslipTemplateRepository();
  }

  async listTemplates(tenantId: string): Promise<PayslipTemplateDocument[]> {
    return this.repo.findActive(tenantId);
  }

  async getTemplateById(tenantId: string, id: string): Promise<PayslipTemplateDocument> {
    const template = await PayslipTemplateModel.findOne({ _id: id, tenantId, isActive: true });
    if (!template) throw NotFoundError("Payslip template not found");
    return template;
  }

  async setDefaultFormat(tenantId: string, templateCode: string): Promise<PayslipTemplateDocument> {
    const template = await this.repo.findByTemplateCode(tenantId, templateCode);
    if (!template) throw NotFoundError(`Template ${templateCode} not found`);

    // Reset other defaults
    await PayslipTemplateModel.updateMany({ tenantId }, { isCompanyDefault: false });

    // Set new default
    template.isCompanyDefault = true;
    return template.save();
  }

  async createCustomTemplate(tenantId: string, input: any): Promise<PayslipTemplateDocument> {
    if (input.isCompanyDefault) {
      await PayslipTemplateModel.updateMany({ tenantId }, { isCompanyDefault: false });
    }
    return PayslipTemplateModel.create({ ...input, tenantId });
  }

  async updateCustomTemplate(tenantId: string, id: string, input: any): Promise<PayslipTemplateDocument> {
    const template = await PayslipTemplateModel.findOne({ _id: id, tenantId });
    if (!template) throw NotFoundError("Payslip template not found");

    if (input.isCompanyDefault) {
      await PayslipTemplateModel.updateMany({ tenantId, _id: { $ne: id } }, { isCompanyDefault: false });
    }

    Object.assign(template, input);
    return template.save();
  }

  async setDefaultById(tenantId: string, id: string): Promise<PayslipTemplateDocument> {
    const template = await PayslipTemplateModel.findOne({ _id: id, tenantId });
    if (!template) throw NotFoundError("Payslip template not found");

    await PayslipTemplateModel.updateMany({ tenantId }, { isCompanyDefault: false });
    template.isCompanyDefault = true;
    return template.save();
  }

  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const template = await PayslipTemplateModel.findOne({ _id: id, tenantId });
    if (!template) throw NotFoundError("Payslip template not found");

    template.isActive = false;
    await template.save();
  }
}
