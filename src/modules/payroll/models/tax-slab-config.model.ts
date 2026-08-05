// src/modules/payroll/models/tax-slab-config.model.ts
//
// NEW FILE.
//
// Income tax slabs change with the Union Budget most years — hardcoding
// them means a redeploy every time Finance updates the law. This follows
// the exact same DB-driven pattern already used for
// ProfessionalTaxConfigModel and LWFConfigModel in statutory-config.model.ts:
// Finance/HR upserts a config document per financial year + regime, and
// payroll-engine.service.ts reads it at TDS-calculation time.
//
// If no config exists for a given financial year, calculateTDS() falls
// back to a hardcoded FY2025-26 default (see payroll-engine.service.ts),
// so payroll never silently breaks — it just won't reflect a brand new
// budget until someone seeds the new slabs.

import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";
import { TaxRegime } from "./statutory-config.model";

export interface TaxSlab {
  minIncome: number;
  maxIncome: number; // 0 = no upper limit (top slab)
  rate: number;       // e.g. 0.05 for 5%
}

export interface TaxSlabConfigDocument extends OrgLevelDocument {
  regime: TaxRegime;
  financialYear: string;        // "2025-26"
  slabs: TaxSlab[];
  standardDeduction: number;     // 75000 (NEW) / 50000 (OLD)
  rebateCeiling: number;         // taxable income must be <= this for rebate to apply. 0 = no rebate.
  rebateMaxAmount: number;       // max rebate amount (Section 87A), e.g. 60000 (NEW) / 12500 (OLD)
  marginalReliefUpperLimit: number; // 0 = no marginal relief zone (e.g. OLD regime)
  cessRate: number;              // 0.04 = 4% Health & Education Cess
  isActive: boolean;
}

const TaxSlabSchema = new mongoose.Schema(
  {
    minIncome: { type: Number, required: true, min: 0 },
    maxIncome: { type: Number, required: true, min: 0 },
    rate:      { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const TaxSlabConfigSchema = createOrgLevelSchema<TaxSlabConfigDocument>(
  {
    regime: {
      type:     String,
      enum:     Object.values(TaxRegime),
      required: true,
    },
    financialYear: {
      type:     String,
      required: true,
      trim:     true,
    },
    slabs: {
      type:     [TaxSlabSchema],
      required: true,
      validate: {
        validator: (v: TaxSlab[]) => Array.isArray(v) && v.length > 0,
        message:   "At least one slab is required",
      },
    },
    standardDeduction: {
      type:     Number,
      required: true,
      min:      0,
    },
    rebateCeiling: {
      type:    Number,
      default: 0,
      min:     0,
    },
    rebateMaxAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },
    marginalReliefUpperLimit: {
      type:    Number,
      default: 0,
      min:     0,
    },
    cessRate: {
      type:    Number,
      default: 0.04,
      min:     0,
      max:     1,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "payroll_tax_slab_configs" }
);

// One config per regime per financial year per tenant
TaxSlabConfigSchema.index({ tenantId: 1, regime: 1, financialYear: 1 }, { unique: true });

export const TaxSlabConfigModel = mongoose.model<TaxSlabConfigDocument>(
  "TaxSlabConfig",
  TaxSlabConfigSchema
);