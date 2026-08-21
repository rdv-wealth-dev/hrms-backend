import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export enum ComponentType {
    EARNING = "EARNING",       // adds to gross
    DEDUCTION = "DEDUCTION",   // subtracts from gross
    CONTRIBUTION = "CONTRIBUTION" // employer contribution (PF, ESI, Gratuity)
}

export enum ComponentCategory {
    BASE = "BASE",             // Basic, HRA, Special Allowance
    RECURRING = "RECURRING",   // Vehicle, Travel, AK Allowance
    VARIABLE = "VARIABLE",     // Monthly Incentive, Bonuses (Festival, Xmas, Annual)
    ADHOC = "ADHOC"            // Advances, Loans, Arrears, One-off adjustments
}

export enum ComponentCalculationType {
    FLAT = "FLAT",                         // fixed amount every cycle
    PERCENTAGE_OF = "PERCENTAGE_OF",       // % of another component (e.g. HRA = 40% of Basic)
    PERCENTAGE_OF_BASIC = "PERCENTAGE_OF_BASIC",
    PERCENTAGE_OF_CTC = "PERCENTAGE_OF_CTC",
    FORMULA = "FORMULA",                   // Custom expression: e.g. "12000 * 12", "Basic * 0.0481"
    SLAB_WISE = "SLAB_WISE",               // Tiered bracket formula
    BALANCING_AMOUNT = "BALANCING_AMOUNT"  // Balances out the remaining CTC
}

export enum PayoutFrequency {
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    ANNUALLY = "ANNUALLY"
}

export interface SalaryComponentDocument extends OrgLevelDocument {
    name: string;                   // "Basic", "HRA", "Festival Bonus"
    code: string;                   // "BASIC", "HRA", "FESTIVAL_BONUS"
    type: ComponentType;
    category: ComponentCategory;
    calculationType: ComponentCalculationType;
    formulaExpression?: string;     // e.g. "CTC * 0.40", "12000 * 12", "Basic * 0.0481"
    percentageOf?: string;          // component code this is a % of, if PERCENTAGE_OF
    percentageValue?: number;       // e.g. 40 for 40%
    payoutFrequency: PayoutFrequency;
    dueMonth?: number;              // 1 to 12 (e.g. 10 for October annual bonus)
    isTaxable: boolean;
    proofRequired: boolean;         // Needs tax exemption proof document upload
    isLopDependent: boolean;        // Proportionately deducted on unpaid leave / LOP
    isEsiApplicable: boolean;       // Included in ESI gross threshold calculation
    isIncludedInCtc: boolean;       // Formally factored inside employee's Annual CTC
    allowIndividualOverride: boolean;// Can HR manually customize this amount per employee
    isPartOfWages: boolean;         // 50% "wages" floor under 2026 Labour Codes
    isStatutory: boolean;           // system-managed vs HR-defined
    isActive: boolean;
}

const SalaryComponentSchema = createOrgLevelSchema<SalaryComponentDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxLength: 100,
        },
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxLength: 50,
        },
        type: {
            type: String,
            enum: Object.values(ComponentType),
            required: true,
        },
        category: {
            type: String,
            enum: Object.values(ComponentCategory),
            default: ComponentCategory.BASE,
        },
        calculationType: {
            type: String,
            enum: Object.values(ComponentCalculationType),
            default: ComponentCalculationType.FLAT,
        },
        formulaExpression: {
            type: String,
            trim: true,
        },
        percentageOf: {
            type: String,
            trim: true,
            uppercase: true,
        },
        percentageValue: {
            type: Number,
            min: 0,
        },
        payoutFrequency: {
            type: String,
            enum: Object.values(PayoutFrequency),
            default: PayoutFrequency.MONTHLY,
        },
        dueMonth: {
            type: Number,
            min: 1,
            max: 12,
        },
        isTaxable: {
            type: Boolean,
            default: true,
        },
        proofRequired: {
            type: Boolean,
            default: false,
        },
        isLopDependent: {
            type: Boolean,
            default: true,
        },
        isEsiApplicable: {
            type: Boolean,
            default: true,
        },
        isIncludedInCtc: {
            type: Boolean,
            default: true,
        },
        allowIndividualOverride: {
            type: Boolean,
            default: false,
        },
        isPartOfWages: {
            type: Boolean,
            default: true,
        },
        isStatutory: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { collection: "salary_components" }
);

SalaryComponentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
SalaryComponentSchema.index({ tenantId: 1, type: 1 });
SalaryComponentSchema.index({ tenantId: 1, category: 1 });
SalaryComponentSchema.index({ tenantId: 1, isActive: 1 });

export const SalaryComponentModel = mongoose.model<SalaryComponentDocument>(
    "SalaryComponent",
    SalaryComponentSchema
);