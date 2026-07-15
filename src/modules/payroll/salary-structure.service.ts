import mongoose from "mongoose";
import { SalaryStructureRepository } from "./salary-structure.repository";
import { SalaryComponentRepository } from "./salary-component.repository";
import { CreateSalaryStructureInput } from "./payroll.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { ComponentType } from "./salary-component.model";

export class SalaryStructureService {
  private structureRepo = new SalaryStructureRepository();
  private componentRepo = new SalaryComponentRepository();

  async createOrRevise(context: RequestContext, input: CreateSalaryStructureInput) {
    const codes = input.lineItems.map(li => li.componentCode);
    const components = await this.componentRepo.findAllByCodes(context, codes);

    if (components.length !== codes.length) {
      const found = new Set(components.map(c => c.code));
      const missing = codes.filter(c => !found.has(c.toUpperCase()));
      throw new AppError(`Unknown salary component code(s): ${missing.join(", ")}`, 400);
    }

    const componentMap = new Map(components.map(c => [c.code, c]));

    let grossMonthly = 0;
    let totalDeductionsMonthly = 0;
    let wagesForStatutory = 0;

    const lineItems = input.lineItems.map((li) => {
      const comp = componentMap.get(li.componentCode.toUpperCase())!;
      if (comp.type === ComponentType.EARNING) {
        grossMonthly += li.amount;
        if (comp.isPartOfWages) wagesForStatutory += li.amount;
      } else {
        totalDeductionsMonthly += li.amount;
      }
      return {
        componentId:   comp._id,
        componentCode: comp.code,
        amount:        li.amount,
      };
    });

    // 50% Wage Rule validation — flag at configuration time, not payroll run time
    // (statutory_compliance_labour_codes_2026.md §2)
    const excludedFromWages = grossMonthly - wagesForStatutory;
    if (grossMonthly > 0 && (excludedFromWages / grossMonthly) > 0.5) {
      throw new AppError(
        `This salary structure excludes ${Math.round((excludedFromWages / grossMonthly) * 100)}% of gross from "wages" — exceeds the 50% statutory ceiling. Reclassify some allowance components as isPartOfWages.`,
        400
      );
    }

    // Close out any existing active structure for this employee
    const current = await this.structureRepo.findActiveForEmployee(context, input.employeeId);
    const now = new Date();
    if (current) {
      current.effectiveTo = now;
      await this.structureRepo.save(current);
    }

    const netMonthly = grossMonthly - totalDeductionsMonthly;

    const structure = await this.structureRepo.create({
      tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:      new mongoose.Types.ObjectId(context.branchIds[0] ?? "") as any,
      employeeId:    new mongoose.Types.ObjectId(input.employeeId) as any,
      effectiveFrom: now,
      effectiveTo:   null,
      supersedes:    current?._id ?? null,
      ctcAnnual:     input.ctcAnnual,
      lineItems,
      grossMonthly,
      totalDeductionsMonthly,
      netMonthly,
      wagesForStatutory,
      isActive: true,
    });

    return structure;
  }

  async getActiveForEmployee(context: RequestContext, employeeId: string) {
    const structure = await this.structureRepo.findActiveForEmployee(context, employeeId);
    if (!structure) throw new AppError("No active salary structure found for this employee", 404);
    return structure;
  }
}