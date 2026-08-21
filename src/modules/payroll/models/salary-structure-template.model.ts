import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export interface StructureTemplateRule {
  componentCode: string;
  calculationType: "FLAT" | "PERCENTAGE_OF_BASIC" | "PERCENTAGE_OF_CTC" | "FORMULA" | "SLAB_WISE" | "BALANCING_AMOUNT";
  formulaExpression: string;
  roundMode?: "ROUND" | "FLOOR" | "CEIL";
}

export interface SalaryStructureTemplateDocument extends OrgLevelDocument {
  name: string;
  description?: string;
  structureType: "REGULAR" | "CONTRACTOR" | "JOB_BASED_WAGE" | "HOURLY_WAGE";
  isCompanyDefault: boolean;
  earningsRules: StructureTemplateRule[];
  deductionsRules: StructureTemplateRule[];
  assignedEmployeesCount: number;
  isActive: boolean;
}

const StructureTemplateRuleSchema = new mongoose.Schema(
  {
    componentCode: { type: String, required: true, uppercase: true, trim: true },
    calculationType: { type: String, required: true },
    formulaExpression: { type: String, required: true },
    roundMode: { type: String, enum: ["ROUND", "FLOOR", "CEIL"], default: "ROUND" },
  },
  { _id: false }
);

const SalaryStructureTemplateSchema = createOrgLevelSchema<SalaryStructureTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    structureType: {
      type: String,
      enum: ["REGULAR", "CONTRACTOR", "JOB_BASED_WAGE", "HOURLY_WAGE"],
      default: "REGULAR",
    },
    isCompanyDefault: { type: Boolean, default: false },
    earningsRules: { type: [StructureTemplateRuleSchema], default: [] },
    deductionsRules: { type: [StructureTemplateRuleSchema], default: [] },
    assignedEmployeesCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { collection: "salary_structure_templates" }
);

SalaryStructureTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });
SalaryStructureTemplateSchema.index({ tenantId: 1, structureType: 1 });
SalaryStructureTemplateSchema.index({ tenantId: 1, isCompanyDefault: 1 });

export const SalaryStructureTemplateModel = mongoose.model<SalaryStructureTemplateDocument>(
  "SalaryStructureTemplate",
  SalaryStructureTemplateSchema
);
