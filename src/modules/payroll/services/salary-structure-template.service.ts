import { SalaryStructureTemplateRepository } from "../repositories/salary-structure-template.repository";
import { SalaryStructureModel } from "../models/salary-structure.model";
import { SalaryComponentModel } from "../models/salary-component.model";
import { SalaryStructureTemplateDocument, SalaryStructureTemplateModel } from "../models/salary-structure-template.model";
import { FormulaParser } from "../utils/formula-parser.util";
import { NotFoundError } from "../../../shared/errors/app.error";

export class SalaryStructureTemplateService {
  private templateRepo: SalaryStructureTemplateRepository;

  constructor() {
    this.templateRepo = new SalaryStructureTemplateRepository();
  }

  async createTemplate(tenantId: string, input: any): Promise<SalaryStructureTemplateDocument> {
    if (input.isCompanyDefault) {
      await SalaryStructureTemplateModel.updateMany({ tenantId }, { isCompanyDefault: false });
    }
    return SalaryStructureTemplateModel.create({ ...input, tenantId });
  }

  async listTemplates(tenantId: string): Promise<SalaryStructureTemplateDocument[]> {
    return this.templateRepo.findActive(tenantId);
  }

  async getTemplateById(tenantId: string, id: string): Promise<SalaryStructureTemplateDocument> {
    const template = await SalaryStructureTemplateModel.findOne({ _id: id, tenantId, isActive: true });
    if (!template) throw NotFoundError("Salary structure template not found");
    return template;
  }

  async updateTemplate(tenantId: string, id: string, input: any): Promise<SalaryStructureTemplateDocument> {
    const template = await SalaryStructureTemplateModel.findOne({ _id: id, tenantId });
    if (!template) throw NotFoundError("Salary structure template not found");

    if (input.isCompanyDefault) {
      await SalaryStructureTemplateModel.updateMany({ tenantId, _id: { $ne: id } }, { isCompanyDefault: false });
    }

    Object.assign(template, input);
    return template.save();
  }

  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const template = await SalaryStructureTemplateModel.findOne({ _id: id, tenantId });
    if (!template) throw NotFoundError("Salary structure template not found");

    template.isActive = false;
    await template.save();
  }

  async assignBulk(
    tenantId: string,
    templateId: string,
    employeeIds: string[],
    annualCtc: number,
    effectiveFrom: Date
  ): Promise<{ assignedCount: number }> {
    const template = await this.getTemplateById(tenantId, templateId);
    const monthlyCtc = annualCtc / 12;

    for (const employeeId of employeeIds) {
      const earnings: any[] = [];
      let totalAssignedEarnings = 0;
      let balancingComponentCode: string | null = null;

      // 1st pass: Calculate base & formula earnings
      for (const rule of template.earningsRules) {
        if (rule.calculationType === "BALANCING_AMOUNT") {
          balancingComponentCode = rule.componentCode;
          continue;
        }

        const comp = await SalaryComponentModel.findOne({ tenantId, code: rule.componentCode, isActive: true });
        const formulaContext = {
          CTC: monthlyCtc,
          BASIC: earnings.find((e) => e.componentCode === "BASIC")?.monthlyAmount || 0,
        };

        const calculatedAmount = Math.round(FormulaParser.evaluate(rule.formulaExpression, formulaContext));
        earnings.push({
          componentId: comp?._id,
          componentCode: rule.componentCode,
          monthlyAmount: calculatedAmount,
          annualAmount: calculatedAmount * 12,
        });
        totalAssignedEarnings += calculatedAmount;
      }

      // 2nd pass: Fill balancing amount (Special Allowance)
      if (balancingComponentCode) {
        const comp = await SalaryComponentModel.findOne({ tenantId, code: balancingComponentCode, isActive: true });
        const balancingAmount = Math.max(0, monthlyCtc - totalAssignedEarnings);
        earnings.push({
          componentId: comp?._id,
          componentCode: balancingComponentCode,
          monthlyAmount: balancingAmount,
          annualAmount: balancingAmount * 12,
        });
      }

      // Deductions calculation
      const deductions: any[] = [];
      for (const rule of template.deductionsRules) {
        const comp = await SalaryComponentModel.findOne({ tenantId, code: rule.componentCode, isActive: true });
        const formulaContext = {
          CTC: monthlyCtc,
          BASIC: earnings.find((e) => e.componentCode === "BASIC")?.monthlyAmount || 0,
        };
        const calculatedAmount = Math.round(FormulaParser.evaluate(rule.formulaExpression, formulaContext));
        deductions.push({
          componentId: comp?._id,
          componentCode: rule.componentCode,
          monthlyAmount: calculatedAmount,
          annualAmount: calculatedAmount * 12,
        });
      }

      const grossMonthly = earnings.reduce((acc, e) => acc + e.monthlyAmount, 0);

      // Deactivate previous active structure
      await SalaryStructureModel.updateMany(
        { tenantId, employeeId, isActive: true },
        { isActive: false }
      );

      // Save new active structure
      await SalaryStructureModel.create({
        tenantId,
        employeeId: employeeId as any,
        annualCtc,
        grossMonthly,
        netMonthly: grossMonthly - deductions.reduce((acc, d) => acc + d.monthlyAmount, 0),
        effectiveFrom,
        earnings,
        deductions,
        contributions: [],
        isActive: true,
      } as any);
    }

    // Update assigned count on template
    await SalaryStructureTemplateModel.findByIdAndUpdate(templateId, {
      $inc: { assignedEmployeesCount: employeeIds.length },
    });

    return { assignedCount: employeeIds.length };
  }
}
