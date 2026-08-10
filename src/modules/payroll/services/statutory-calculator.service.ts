import mongoose from "mongoose";
import {
  ProfessionalTaxConfigModel,
  LWFConfigModel,
  TaxDeclarationModel,
  OvertimeConfigModel,
  TaxRegime,
} from "../models/statutory-config.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

// PROFESSIONAL TAX SERVICE

export class ProfessionalTaxService {

  async upsertConfig(context: RequestContext, input: {
    stateCode: string;
    stateName?: string;
    financialYear: string;
    slabs: { minSalary: number; maxSalary: number; ptAmount: number }[];
    frequency?: "MONTHLY" | "ANNUAL";
  }) {
    const existing = await ProfessionalTaxConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      stateCode: input.stateCode.toUpperCase(),
      financialYear: input.financialYear,
    });

    if (existing) {
      existing.slabs = input.slabs as any;
      if (input.frequency) (existing as any).frequency = input.frequency;
      return existing.save();
    }

    return ProfessionalTaxConfigModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(context.branchIds[0] ?? ""),
      stateCode: input.stateCode.toUpperCase(),
      financialYear: input.financialYear,
      slabs: input.slabs,
      isActive: true,
    });
  }

  async listConfigs(context: RequestContext, financialYear?: string) {
    const filter: any = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isActive: true,
      isDeleted: false,
    };
    if (financialYear) filter.financialYear = financialYear;
    return ProfessionalTaxConfigModel.find(filter).sort({ stateCode: 1 }).lean();
  }

  async deleteConfig(context: RequestContext, id: string) {
    const config = await ProfessionalTaxConfigModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    });
    if (!config) throw new AppError("PT config not found", 404);
    config.isActive = false;
    config.isDeleted = true;
    await config.save();
    return { message: "PT configuration removed" };
  }
}

// LWF SERVICE

export class LWFConfigService {

  async upsertConfig(context: RequestContext, input: {
    stateCode: string;
    financialYear: string;
    employeeContribution: number;
    employerContribution: number;
    deductionMonths: number[];
  }) {
    const existing = await LWFConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      stateCode: input.stateCode.toUpperCase(),
      financialYear: input.financialYear,
    });

    if (existing) {
      existing.employeeContribution = input.employeeContribution;
      existing.employerContribution = input.employerContribution;
      existing.deductionMonths = input.deductionMonths;
      return existing.save();
    }

    return LWFConfigModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(context.branchIds[0] ?? ""),
      stateCode: input.stateCode.toUpperCase(),
      financialYear: input.financialYear,
      employeeContribution: input.employeeContribution,
      employerContribution: input.employerContribution,
      deductionMonths: input.deductionMonths,
      isActive: true,
    });
  }

  async listConfigs(context: RequestContext, financialYear?: string) {
    const filter: any = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isActive: true,
      isDeleted: false,
    };
    if (financialYear) filter.financialYear = financialYear;
    return LWFConfigModel.find(filter).sort({ stateCode: 1 }).lean();
  }
}

// OVERTIME CONFIG SERVICE

export class OvertimeConfigService {

  async upsertConfig(context: RequestContext, input: {
    standardHoursPerDay?: number;
    otMultiplier?: number;
    holidayOtMultiplier?: number;
    maxOtHoursPerDay?: number;
    maxOtHoursPerWeek?: number;
    otEligibleEmployeeTypes?: string[];
  }) {
    const branchId = context.branchIds[0] ?? "";

    const existing = await OvertimeConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isActive: true,
      isDeleted: false,
    });

    if (existing) {
      if (input.standardHoursPerDay !== undefined) existing.standardHoursPerDay = input.standardHoursPerDay;
      if (input.otMultiplier !== undefined) existing.otMultiplier = input.otMultiplier;
      if (input.holidayOtMultiplier !== undefined) existing.holidayOtMultiplier = input.holidayOtMultiplier;
      if (input.maxOtHoursPerDay !== undefined) existing.maxOtHoursPerDay = input.maxOtHoursPerDay;
      if (input.maxOtHoursPerWeek !== undefined) existing.maxOtHoursPerWeek = input.maxOtHoursPerWeek;
      if (input.otEligibleEmployeeTypes !== undefined) existing.otEligibleEmployeeTypes = input.otEligibleEmployeeTypes;
      return existing.save();
    }

    return OvertimeConfigModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      standardHoursPerDay: input.standardHoursPerDay ?? 8,
      otMultiplier: input.otMultiplier ?? 2.0,
      holidayOtMultiplier: input.holidayOtMultiplier ?? 2.0,
      maxOtHoursPerDay: input.maxOtHoursPerDay ?? 4,
      maxOtHoursPerWeek: input.maxOtHoursPerWeek ?? 50,
      otEligibleEmployeeTypes: input.otEligibleEmployeeTypes ?? ["FULL_TIME", "CONTRACT"],
      isActive: true,
    });
  }

  async getConfig(context: RequestContext) {
    const branchId = context.branchIds[0] ?? "";
    return OvertimeConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isActive: true,
      isDeleted: false,
    }).lean();
  }
}

// TAX DECLARATION SERVICE
// Employee self-service — submits once per year, revises before deadline

export class TaxDeclarationService {

  async submitOrRevise(
    context: RequestContext,
    employeeId: string,
    input: {
      financialYear: string;
      regime: TaxRegime;
      rentPaidMonthly?: number;
      isMetroCity?: boolean;
      section80C?: number;
      section80D?: number;
      section80CCD1B?: number;
      homeLoanInterest?: number;
      ltaAmount?: number;
    }
  ) {
    const existing = await TaxDeclarationModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      financialYear: input.financialYear,
      isDeleted: false,
    });

    if (existing) {
      existing.regime = input.regime;
      existing.rentPaidMonthly = input.rentPaidMonthly ?? existing.rentPaidMonthly;
      existing.isMetroCity = input.isMetroCity ?? existing.isMetroCity;
      existing.section80C = input.section80C ?? existing.section80C;
      existing.section80D = input.section80D ?? existing.section80D;
      existing.section80CCD1B = input.section80CCD1B ?? existing.section80CCD1B;
      existing.homeLoanInterest = input.homeLoanInterest ?? existing.homeLoanInterest;
      existing.ltaAmount = input.ltaAmount ?? existing.ltaAmount;
      existing.revisedAt = new Date();
      return existing.save();
    }

    return TaxDeclarationModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(context.branchIds[0] ?? ""),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      financialYear: input.financialYear,
      regime: input.regime,
      rentPaidMonthly: input.rentPaidMonthly,
      isMetroCity: input.isMetroCity,
      section80C: input.section80C,
      section80D: input.section80D,
      section80CCD1B: input.section80CCD1B,
      homeLoanInterest: input.homeLoanInterest,
      ltaAmount: input.ltaAmount,
      submittedAt: new Date(),
      isProofSubmitted: false,
    });
  }

  async getDeclaration(
    context: RequestContext,
    employeeId: string,
    financialYear: string
  ) {
    return TaxDeclarationModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      financialYear,
      isDeleted: false,
    }).lean();
  }

  async markProofSubmitted(
    context: RequestContext,
    employeeId: string,
    financialYear: string
  ) {
    const decl = await TaxDeclarationModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      financialYear,
      isDeleted: false,
    });
    if (!decl) throw new AppError("Tax declaration not found", 404);
    decl.isProofSubmitted = true;
    return decl.save();
  }
}