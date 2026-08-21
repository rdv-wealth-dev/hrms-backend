import { BaseRepository } from "../../../shared/database/base.repository";
import {
  SalaryStructureTemplateDocument,
  SalaryStructureTemplateModel,
} from "../models/salary-structure-template.model";

export class SalaryStructureTemplateRepository extends BaseRepository<SalaryStructureTemplateDocument> {
  constructor() {
    super(SalaryStructureTemplateModel);
  }

  async findDefault(tenantId: string): Promise<SalaryStructureTemplateDocument | null> {
    return this.model.findOne({ tenantId, isCompanyDefault: true, isActive: true });
  }

  async findActive(tenantId: string): Promise<SalaryStructureTemplateDocument[]> {
    return this.model.find({ tenantId, isActive: true });
  }
}
