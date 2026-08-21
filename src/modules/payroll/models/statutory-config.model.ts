import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../shared/database/base.schema";

// ─────────────────────────────────────────────────────────────────────────────
// TAX REGIME ENUM
// ─────────────────────────────────────────────────────────────────────────────

export enum TaxRegime {
  OLD = "OLD",
  NEW = "NEW",
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL TAX (PT) CONFIG MODEL
// Slabs configuration for different gross monthly salaries per state
// ─────────────────────────────────────────────────────────────────────────────

export interface PTSlab {
  minSalary: number;
  maxSalary: number; // 0 represents no upper limit
  ptAmount: number;
}

export interface ProfessionalTaxConfigDocument extends BaseDocument {
  stateCode: string;         // Upper-case short state code (e.g. "KA", "MH")
  financialYear: string;         // Financial Year (e.g. "2025-26")
  slabs: PTSlab[];       // Slabs list
  isActive: boolean;
}

const PTSlabSchema = new mongoose.Schema(
  {
    minSalary: { type: Number, required: true, min: 0 },
    maxSalary: { type: Number, required: true, min: 0 },
    ptAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProfessionalTaxConfigSchema = createBaseSchema<ProfessionalTaxConfigDocument>(
  {
    stateCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    slabs: {
      type: [PTSlabSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { collection: "payroll_pt_configs" }
);

ProfessionalTaxConfigSchema.index({ tenantId: 1, stateCode: 1, financialYear: 1 }, { unique: true });

export const ProfessionalTaxConfigModel = mongoose.model<ProfessionalTaxConfigDocument>(
  "ProfessionalTaxConfig",
  ProfessionalTaxConfigSchema
);

// ─────────────────────────────────────────────────────────────────────────────
// LABOUR WELFARE FUND (LWF) CONFIG MODEL
// LWF contribution rules per state
// ─────────────────────────────────────────────────────────────────────────────

export interface LWFConfigDocument extends BaseDocument {
  stateCode: string;
  financialYear: string;
  deductionMonths: number[];  // E.g., [6, 12] for June and December
  employeeContribution: number;
  employerContribution: number;
  isActive: boolean;
}

const LWFConfigSchema = createBaseSchema<LWFConfigDocument>(
  {
    stateCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    deductionMonths: {
      type: [Number],
      default: [],
    },
    employeeContribution: {
      type: Number,
      required: true,
      min: 0,
    },
    employerContribution: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { collection: "payroll_lwf_configs" }
);

LWFConfigSchema.index({ tenantId: 1, stateCode: 1, financialYear: 1 }, { unique: true });

export const LWFConfigModel = mongoose.model<LWFConfigDocument>(
  "LWFConfig",
  LWFConfigSchema
);

// ─────────────────────────────────────────────────────────────────────────────
// TAX DECLARATION MODEL
// Income Tax regime selection and investment declarations under 80C/80D/80CCD
// ─────────────────────────────────────────────────────────────────────────────

export interface TaxDeclarationDocument extends BaseDocument {
  employeeId: mongoose.Types.ObjectId;
  financialYear: string;
  regime: TaxRegime;
  rentPaidMonthly?: number;
  isMetroCity?: boolean;
  ltaAmount?: number;
  section80C?: number;
  section80D?: number;
  section80CCD1B?: number;
  homeLoanInterest?: number;
  submittedAt: Date;
  revisedAt?: Date;
  isProofSubmitted: boolean;
}

const TaxDeclarationSchema = createBaseSchema<TaxDeclarationDocument>(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Employee",
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    regime: {
      type: String,
      enum: Object.values(TaxRegime),
      default: TaxRegime.NEW,
    },
    rentPaidMonthly: { type: Number, default: 0 },
    isMetroCity: { type: Boolean, default: false },
    ltaAmount: { type: Number, default: 0 },
    section80C: { type: Number, default: 0 },
    section80D: { type: Number, default: 0 },
    section80CCD1B: { type: Number, default: 0 },
    homeLoanInterest: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    revisedAt: { type: Date },
    isProofSubmitted: { type: Boolean, default: false },
  },
  { collection: "payroll_tax_declarations" }
);

TaxDeclarationSchema.index({ tenantId: 1, employeeId: 1, financialYear: 1 }, { unique: true });

export const TaxDeclarationModel = mongoose.model<TaxDeclarationDocument>(
  "TaxDeclaration",
  TaxDeclarationSchema
);

// =============================================================================
// OVERTIME CONFIG
// =============================================================================

export interface OvertimeConfigDocument extends BaseDocument {
  standardHoursPerDay: number;
  otMultiplier: number;
  holidayOtMultiplier: number;
  maxOtHoursPerDay: number;
  maxOtHoursPerWeek: number;
  otEligibleEmployeeTypes: string[];
  isActive: boolean;
}

const OvertimeConfigSchema = createBaseSchema<OvertimeConfigDocument>(
  {
    standardHoursPerDay: { type: Number, default: 8 },
    otMultiplier: { type: Number, default: 2.0 },
    holidayOtMultiplier: { type: Number, default: 2.0 },
    maxOtHoursPerDay: { type: Number, default: 4 },
    maxOtHoursPerWeek: { type: Number, default: 50 },
    otEligibleEmployeeTypes: {
      type: [String],
      default: ["FULL_TIME", "CONTRACT"],
    },
    isActive: { type: Boolean, default: true },
  },
  { collection: "overtime_configs" }
);

OvertimeConfigSchema.index({ tenantId: 1, branchId: 1 });

export const OvertimeConfigModel = mongoose.model<OvertimeConfigDocument>(
  "OvertimeConfig",
  OvertimeConfigSchema
);

// =============================================================================
// PF & ESI STATUTORY COMPLIANCE CONFIG
// =============================================================================

export interface PfEsiConfigDocument extends BaseDocument {
  isPfEnabled: boolean;
  pfWageCeiling: number;
  restrictPfToWageCeiling: boolean;
  employeePfRate: number;
  employerPfRate: number;
  isEpsEnabled: boolean;
  epsRate: number;
  epsCeilingAmount: number;
  edliRate: number;
  adminChargesRate: number;
  isEsiEnabled: boolean;
  esiGrossCeiling: number;
  employeeEsiRate: number;
  employerEsiRate: number;
  isActive: boolean;
}

const PfEsiConfigSchema = createBaseSchema<PfEsiConfigDocument>(
  {
    isPfEnabled: { type: Boolean, default: true },
    pfWageCeiling: { type: Number, default: 15000 },
    restrictPfToWageCeiling: { type: Boolean, default: true },
    employeePfRate: { type: Number, default: 0.12 },
    employerPfRate: { type: Number, default: 0.12 },
    isEpsEnabled: { type: Boolean, default: true },
    epsRate: { type: Number, default: 0.0833 },
    epsCeilingAmount: { type: Number, default: 1250 },
    edliRate: { type: Number, default: 0.005 },
    adminChargesRate: { type: Number, default: 0.005 },

    isEsiEnabled: { type: Boolean, default: true },
    esiGrossCeiling: { type: Number, default: 21000 },
    employeeEsiRate: { type: Number, default: 0.0075 },
    employerEsiRate: { type: Number, default: 0.0325 },
    isActive: { type: Boolean, default: true },
  },
  { collection: "payroll_pf_esi_configs" }
);

PfEsiConfigSchema.index({ tenantId: 1 }, { unique: true });

export const PfEsiConfigModel = mongoose.model<PfEsiConfigDocument>(
  "PfEsiConfig",
  PfEsiConfigSchema
);

