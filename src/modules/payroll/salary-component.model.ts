import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";
import { create } from "domain";

// A salary component is a reusable building block — Basic, HRA, Conveyance,
// PF Deduction, etc. Tenant-defined, not hardcoded — matches the same
// "policy engine" principle we applied to LeaveType: no fixed component
// list baked into code, HR defines whatever their CTC structure needs.

export enum ComponentType {
    EARNING = "EARNING",    // adds to gross
    DEDUCTION = "DEDUCTION",    // subtracts from gross
}

export enum ComponentCalculationType {
    FLAT = "FLAT",                      // fixed amount every cycle
    PERCENTAGE_OF = "PERCENTAGE_OF",    // % of another component (e.g. HRA = 40% of Basic)
    FORMULA = "FORMULA"                 // reserved for future — custom expression
}

export interface SalaryComponentDocument extends OrgLevelDocument{
    name:               string;   // "Basic", "HRA", "Provident Fund"
    code:               string;   // "BASIC", "HRA", "PF"
    type:               ComponentType;
    calculationType:    ComponentCalculationType;
    percentageOf?:       string;   // component code this is a % of, if PERCENTAGE_OF
    percentageValue?:    number;   // e.g. 40 for 40%
    isTaxable:          boolean;
    isPartOfWages:      boolean;  // counts toward the 50% "wages" floor under the 2026 Labour Codes
    isStatutory:        boolean;  // system-managed (PF, ESI, PT, TDS) vs HR-defined
    isActive:           boolean;
}

const SalaryComponentSchema = createOrgLevelSchema<SalaryComponentDocument>(
    {
        name: {
            type : String,
            required : true,
            trim : true,
            maxLength : 100,
        },
        code : {
            type : String,
            required : true,
            trim : true,
            uppercase : true,
            maxLength : 20,
        },
        type: {
            type : String,
            enum : Object.values(ComponentType),
            required : true,
        },
        calculationType : {
            type : String,
            enum : Object.values(ComponentCalculationType),
            default : ComponentCalculationType.FLAT,
        },
        percentageOf : {
            type : String,
            trim : true,
            uppercase : true,
        },
        percentageValue : {
            type : Number,
            min : 0,
            max : 100,
        },
        isTaxable : {
            type : Boolean,
            default : true,
        },
        isPartOfWages: {
            // See statutory_compliance_labour_codes_2026.md §2 — under the 2026
            // Labour Codes, allowances excluded from "wages" cannot exceed 50%
            // of total remuneration. Components marked false here are the
            // "excludable" ones (HRA, conveyance, special allowance etc.)
            type:    Boolean,
            default: true,
        },
        isStatutory: {
            type:    Boolean,
            default: false,
        },
        isActive: {
            type:    Boolean,
            default: true,
        },
    },
    {collection: "salary_components"}
);

SalaryComponentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
SalaryComponentSchema.index({ tenantId: 1, type: 1 });
SalaryComponentSchema.index({ tenantId: 1, isActive: 1 });

export const SalaryComponentModel = mongoose.model<SalaryComponentDocument>(
  "SalaryComponent",
  SalaryComponentSchema
);