import mongoose from "mongoose";
import { SalaryStructureRepository } from "../repositories/salary-structure.repository";
import { SalaryComponentRepository } from "../repositories/salary-component.repository";
import { CreateSalaryStructureInput } from "../dto/payroll.dto";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { ComponentType, ComponentCalculationType } from "../models/salary-component.model";

export class SalaryStructureService {
  private structureRepo = new SalaryStructureRepository();
  private componentRepo = new SalaryComponentRepository();

  async createOrRevise(context: RequestContext, input: CreateSalaryStructureInput) {
    const codes = input.lineItems.map(li => li.componentCode.toUpperCase());
    let components = await this.componentRepo.findAllByCodes(context, codes);

    if (components.length !== codes.length) {
      const found = new Set(components.map(c => c.code.toUpperCase()));
      const missing = codes.filter(c => !found.has(c));

      const standardDefaults: Record<string, { name: string; type: ComponentType; isPartOfWages: boolean; isTaxable: boolean }> = {
        BASIC: { name: "Basic Salary", type: ComponentType.EARNING, isPartOfWages: true, isTaxable: true },
        HRA: { name: "House Rent Allowance", type: ComponentType.EARNING, isPartOfWages: false, isTaxable: true },
        SPECIAL_ALLOWANCE: { name: "Special Allowance", type: ComponentType.EARNING, isPartOfWages: true, isTaxable: true },
        DA: { name: "Dearness Allowance", type: ComponentType.EARNING, isPartOfWages: true, isTaxable: true },
        CONVEYANCE: { name: "Conveyance Allowance", type: ComponentType.EARNING, isPartOfWages: false, isTaxable: true },
        MEDICAL: { name: "Medical Allowance", type: ComponentType.EARNING, isPartOfWages: false, isTaxable: true },
      };

      for (const m of missing) {
        if (standardDefaults[m]) {
          await mongoose.model("SalaryComponent").create({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            name: standardDefaults[m].name,
            code: m,
            type: standardDefaults[m].type,
            calculationType: ComponentCalculationType.FLAT,
            isTaxable: standardDefaults[m].isTaxable,
            isPartOfWages: standardDefaults[m].isPartOfWages,
            isStatutory: false,
            isActive: true,
          });
        }
      }

      components = await this.componentRepo.findAllByCodes(context, codes);


      const updatedFound = new Set(components.map(c => c.code.toUpperCase()));
      const stillMissing = codes.filter(c => !updatedFound.has(c));
      if (stillMissing.length > 0) {
        throw new AppError(`Unknown salary component code(s): ${stillMissing.join(", ")}`, 400);
      }
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
        componentId: comp._id,
        componentCode: comp.code,
        amount: li.amount,
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

    // Resolve employee and branchId
    let employeeDoc = mongoose.Types.ObjectId.isValid(input.employeeId)
      ? await mongoose.model("Employee").findById(input.employeeId).select("branchId")
      : await mongoose.model("Employee").findOne({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeCode: input.employeeId.trim(),
          isDeleted: false,
        }).select("branchId");

    if (!employeeDoc && (context.role === "ORG_ADMIN" || context.role === "SUPER_ADMIN")) {
      employeeDoc = await mongoose.model("Employee").findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      }).select("branchId");
    }

    if (!employeeDoc) {
      throw new AppError("Employee not found", 404);
    }

    const resolvedEmployeeId = employeeDoc._id.toString();
    const resolvedBranchId = (employeeDoc as any).branchId
      ? (employeeDoc as any).branchId
      : (context.branchIds?.[0] ? new mongoose.Types.ObjectId(context.branchIds[0]) : undefined);

    // Close out any existing active structure for this employee
    const current = await this.structureRepo.findActiveForEmployee(context, resolvedEmployeeId);
    const now = new Date();
    if (current) {
      current.effectiveTo = now;
      await this.structureRepo.save(current);
    }

    const netMonthly = grossMonthly - totalDeductionsMonthly;

    const structure = await this.structureRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: resolvedBranchId as any,
      employeeId: new mongoose.Types.ObjectId(resolvedEmployeeId) as any,
      effectiveFrom: now,
      effectiveTo: null,
      supersedes: current?._id ?? null,
      ctcAnnual: input.ctcAnnual,
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
    let resolvedId = employeeId;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      const emp = await mongoose.model("Employee").findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeCode: employeeId.trim(),
        isDeleted: false,
      }).select("_id");
      if (emp) resolvedId = emp._id.toString();
    }
    const structure = await this.structureRepo.findActiveForEmployee(context, resolvedId);
    if (!structure) throw new AppError("No active salary structure found for this employee", 404);
    return structure;
  }
}