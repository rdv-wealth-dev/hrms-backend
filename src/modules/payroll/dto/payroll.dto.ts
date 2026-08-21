import { z } from "zod";
import { objectIdSchema, safeStringSchema, countryCodeSchema } from "../../../shared/validators/common.validator";

//Salary Component
export const CreateSalaryComponentDto = z.object({
  name: safeStringSchema(2, 100),
  code: z.string().trim().toUpperCase().min(1).max(20),
  type: z.enum(["EARNING", "DEDUCTION"]),
  calculationType: z.enum(["FLAT", "PERCENTAGE_OF", "PERCENTAGE", "FORMULA"]).optional().default("FLAT"),
  percentageOf: z.string().trim().toUpperCase().optional(),
  percentageValue: z.number().min(0).max(100).optional(),
  value: z.number().min(0).optional(),
  isTaxable: z.boolean().optional().default(true),
  isPartOfWages: z.boolean().optional().default(true),
}).transform((data) => {
  let calcType = data.calculationType;
  if (calcType === "PERCENTAGE") calcType = "FLAT";
  const pctVal = data.percentageValue !== undefined ? data.percentageValue : data.value;
  return {
    ...data,
    calculationType: calcType as "FLAT" | "PERCENTAGE_OF" | "FORMULA",
    percentageValue: pctVal,
  };
}).refine(
  (data) => data.calculationType !== "PERCENTAGE_OF" || (!!data.percentageOf && data.percentageValue !== undefined),
  { message: "percentageOf and percentageValue are required when calculationType is PERCENTAGE_OF" }
);


export type CreateSalaryComponentInput = z.infer<typeof CreateSalaryComponentDto>;

export const UpdateSalaryComponentDto = z.object({
  name: safeStringSchema(2, 100).optional(),
  isTaxable: z.boolean().optional(),
  isPartOfWages: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSalaryComponentInput = z.infer<typeof UpdateSalaryComponentDto>;

//Salary Structure
export const CreateSalaryStructureDto = z.object({
  employeeId: z.string().trim().min(1),
  ctcAnnual: z.number().min(0),

  lineItems: z.array(z.object({
    componentCode: z.string().trim().toUpperCase(),
    amount: z.number().min(0).optional(),
    value: z.number().min(0).optional(),
    percentage: z.number().min(0).optional(),
  })).min(1, "At least one salary component is required"),
}).transform((data) => {
  const monthlyGross = data.ctcAnnual > 0 ? data.ctcAnnual / 12 : 0;
  return {
    ...data,
    lineItems: data.lineItems.map((li) => {
      let amount = li.amount;
      if (amount === undefined) {
        const val = li.value !== undefined ? li.value : (li.percentage !== undefined ? li.percentage : 0);
        if (val <= 100 && monthlyGross > 0) {
          amount = Math.round((monthlyGross * val) / 100);
        } else {
          amount = val;
        }
      }
      return {
        componentCode: li.componentCode,
        amount,
      };
    }),
  };
});

export type CreateSalaryStructureInput = z.infer<typeof CreateSalaryStructureDto>;


//Payroll Run
export const CreatePayrollRunDto = z.object({
  branchId: objectIdSchema.optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
});

export type CreatePayrollRunInput = z.infer<typeof CreatePayrollRunDto>;

export const ApprovePayrollRunDto = z.object({
  notes: safeStringSchema(0, 500).optional(),
});

export type ApprovePayrollRunInput = z.infer<typeof ApprovePayrollRunDto>;

// ── Attendance Lock ───────────────────────────────────────────────────────

export const AttendanceLockDto = z.object({
  branchId: objectIdSchema.optional(),
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
});
export type AttendanceLockInput = z.infer<typeof AttendanceLockDto>;

export const AttendanceUnlockDto = z.object({
  branchId: objectIdSchema.optional(),
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
  reason: safeStringSchema(5, 500),
});
export type AttendanceUnlockInput = z.infer<typeof AttendanceUnlockDto>;

// ── Overtime ──────────────────────────────────────────────────────────────

export const ApproveOTDto = z.object({});
export type ApproveOTInput = z.infer<typeof ApproveOTDto>;

export const RejectOTDto = z.object({
  reason: safeStringSchema(5, 500),
});
export type RejectOTInput = z.infer<typeof RejectOTDto>;

// ── Professional Tax Config ───────────────────────────────────────────────

export const PTSlabDto = z.object({
  minSalary: z.number().min(0),
  maxSalary: z.number().min(0), // 0 = no upper limit (top slab)
  ptAmount: z.number().min(0),
});

export const UpsertPTConfigDto = z.object({
  stateCode: z.string().trim().toUpperCase().length(2),
  stateName: safeStringSchema(2, 100),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  slabs: z.array(PTSlabDto).min(1, "At least one slab required"),
  frequency: z.enum(["MONTHLY", "ANNUAL"]).optional().default("MONTHLY"),
});
export type UpsertPTConfigInput = z.infer<typeof UpsertPTConfigDto>;

// ── LWF Config ────────────────────────────────────────────────────────────

export const UpsertLWFConfigDto = z.object({
  stateCode: z.string().trim().toUpperCase().length(2),
  stateName: safeStringSchema(2, 100),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  employeeContribution: z.number().min(0),
  employerContribution: z.number().min(0),
  deductionMonths: z.array(z.number().min(1).max(12)).min(1),
});
export type UpsertLWFConfigInput = z.infer<typeof UpsertLWFConfigDto>;

// ── OT Config ─────────────────────────────────────────────────────────────

export const UpsertOTConfigDto = z.object({
  standardHoursPerDay: z.number().min(1).max(24).optional(),
  otMultiplier: z.number().min(1).max(5).optional(),
  holidayOtMultiplier: z.number().min(1).max(5).optional(),
  maxOtHoursPerDay: z.number().min(1).max(24).optional(),
  maxOtHoursPerWeek: z.number().min(1).max(168).optional(),
  otEligibleEmployeeTypes: z.array(z.string()).optional(),
});
export type UpsertOTConfigInput = z.infer<typeof UpsertOTConfigDto>;

// ── Tax Declaration ───────────────────────────────────────────────────────

export const TaxDeclarationDto = z.object({
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  regime: z.enum(["OLD", "NEW"]).default("NEW"),
  // Old regime fields — ignored if regime = NEW
  rentPaidMonthly: z.number().min(0).optional(),
  isMetroCity: z.boolean().optional(),
  section80C: z.number().min(0).max(150000).optional(),
  section80D: z.number().min(0).max(50000).optional(),
  section80CCD1B: z.number().min(0).max(50000).optional(),
  homeLoanInterest: z.number().min(0).max(200000).optional(),
  ltaAmount: z.number().min(0).optional(),
}).refine(
  (data) => {
    // If OLD regime, metro city and rent must be consistent
    if (data.regime === "OLD" && data.rentPaidMonthly && data.rentPaidMonthly > 0) {
      return data.isMetroCity !== undefined;
    }
    return true;
  },
  {
    message: "isMetroCity is required when rentPaidMonthly is provided under Old Regime",
    path: ["isMetroCity"],
  }
);
export type TaxDeclarationInput = z.infer<typeof TaxDeclarationDto>;

// ── Tax Slab Config ───────────────────────────────────────────────────────

export const TaxSlabDto = z.object({
  minIncome: z.number().min(0),
  maxIncome: z.number().min(0), // 0 = no upper limit (top slab)
  rate: z.number().min(0).max(1),
});

export const UpsertTaxSlabConfigDto = z.object({
  regime: z.enum(["OLD", "NEW"]),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  slabs: z.array(TaxSlabDto).min(1, "At least one slab required"),
  standardDeduction: z.number().min(0),
  rebateCeiling: z.number().min(0).optional().default(0),
  rebateMaxAmount: z.number().min(0).optional().default(0),
  marginalReliefUpperLimit: z.number().min(0).optional().default(0),
  cessRate: z.number().min(0).max(1).optional().default(0.04),
});
export type UpsertTaxSlabConfigInput = z.infer<typeof UpsertTaxSlabConfigDto>;

// ── Payroll Adjustments DTOs (Step 3) ──────────────────────────────────────

export const CreatePayrollAdjustmentDto = z.object({
  employeeId: objectIdSchema,
  type: z.enum(["EARNING", "DEDUCTION"]),
  category: z.enum([
    "BONUS",
    "COMMISSION",
    "INCENTIVE",
    "ARREARS",
    "REIMBURSEMENT",
    "ALLOWANCE",
    "LOAN_REPAYMENT",
    "ADVANCE_RECOVERY",
    "PENALTY",
    "NOTICE_PAY",
    "CUSTOM",
  ]),
  customLabel: safeStringSchema(2, 100),
  amount: z.number().positive("Amount must be greater than zero"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  frequency: z.enum(["ONE_TIME", "RECURRING"]).optional().default("ONE_TIME"),
  recurringStartMonth: z.number().min(1).max(12).optional(),
  recurringStartYear: z.number().min(2020).max(2100).optional(),
  recurringEndMonth: z.number().min(1).max(12).optional(),
  recurringEndYear: z.number().min(2020).max(2100).optional(),
  isTaxable: z.boolean().optional(),
  affectsPfWages: z.boolean().optional().default(false),
  affectsEsiWages: z.boolean().optional().default(false),
  notes: safeStringSchema(0, 500).optional(),
});
export type CreatePayrollAdjustmentInput = z.infer<typeof CreatePayrollAdjustmentDto>;

export const BulkCreatePayrollAdjustmentDto = z.object({
  adjustments: z.array(CreatePayrollAdjustmentDto).min(1, "At least one adjustment is required"),
});
export type BulkCreatePayrollAdjustmentInput = z.infer<typeof BulkCreatePayrollAdjustmentDto>;

export const RejectAdjustmentDto = z.object({
  reason: safeStringSchema(3, 500),
});
export type RejectAdjustmentInput = z.infer<typeof RejectAdjustmentDto>;

// ── GL Config DTO (Step 13) ────────────────────────────────────────────────

export const GLAccountItemDto = z.object({
  accountCode: safeStringSchema(1, 50),
  accountName: safeStringSchema(2, 150),
});

export const UpsertPayrollGLConfigDto = z.object({
  grossSalaryExpenseAccount: GLAccountItemDto.optional(),
  employerPfExpenseAccount: GLAccountItemDto.optional(),
  employerEsiExpenseAccount: GLAccountItemDto.optional(),
  gratuityExpenseAccount: GLAccountItemDto.optional(),
  bonusExpenseAccount: GLAccountItemDto.optional(),
  pfPayableAccount: GLAccountItemDto.optional(),
  esiPayableAccount: GLAccountItemDto.optional(),
  ptPayableAccount: GLAccountItemDto.optional(),
  lwfPayableAccount: GLAccountItemDto.optional(),
  tdsPayableAccount: GLAccountItemDto.optional(),
  salariesPayableAccount: GLAccountItemDto.optional(),
});
export type UpsertPayrollGLConfigInput = z.infer<typeof UpsertPayrollGLConfigDto>;

// ── Structure Template DTOs ──
export const StructureTemplateRuleDto = z.object({
  componentCode: z.string().min(1).toUpperCase(),
  calculationType: z.string().min(1),
  formulaExpression: z.string().min(1),
  roundMode: z.enum(["ROUND", "FLOOR", "CEIL"]).optional().default("ROUND"),
});

export const CreateSalaryStructureTemplateDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  structureType: z.enum(["REGULAR", "CONTRACTOR", "JOB_BASED_WAGE", "HOURLY_WAGE"]).optional().default("REGULAR"),
  isCompanyDefault: z.boolean().optional().default(false),
  earningsRules: z.array(StructureTemplateRuleDto),
  deductionsRules: z.array(StructureTemplateRuleDto).optional().default([]),
});
export type CreateSalaryStructureTemplateInput = z.infer<typeof CreateSalaryStructureTemplateDto>;

export const AssignStructureBulkDto = z.object({
  templateId: z.string().min(24),
  employeeIds: z.array(z.string().min(24)).min(1),
  annualCtc: z.number().positive(),
  effectiveFrom: z.string().datetime(),
});
export type AssignStructureBulkInput = z.infer<typeof AssignStructureBulkDto>;

// ── 6-Step Wizard DTOs ──
export const SaveWageInputsDto = z.object({
  wageInputs: z.array(
    z.object({
      employeeId: z.string().min(24),
      type: z.enum(["HOURLY", "DAILY", "JOB_BASED"]),
      rate: z.number().min(0),
      unitsWorked: z.number().min(0),
      overtimeHours: z.number().min(0).optional(),
      overtimeAmount: z.number().min(0).optional(),
    })
  ),
});
export type SaveWageInputsInput = z.infer<typeof SaveWageInputsDto>;

export const SaveSalaryHoldDto = z.object({
  holdList: z.array(
    z.object({
      employeeId: z.string().min(24),
      reason: z.string().optional(),
    })
  ),
});
export type SaveSalaryHoldInput = z.infer<typeof SaveSalaryHoldDto>;

export const SaveTaxOverrideDto = z.object({
  overrides: z.array(
    z.object({
      employeeId: z.string().min(24),
      incomeTaxOverride: z.number().min(0).optional(),
      ptOverride: z.number().min(0).optional(),
      remarks: z.string().optional(),
    })
  ),
});
export type SaveTaxOverrideInput = z.infer<typeof SaveTaxOverrideDto>;

export const BatchGeneratePayslipsDto = z.object({
  employeeIds: z.array(z.string().min(24)).optional(),
  sendEmailNotification: z.boolean().optional().default(false),
  sendSmsNotification: z.boolean().optional().default(false),
});
export type BatchGeneratePayslipsInput = z.infer<typeof BatchGeneratePayslipsDto>;

export const CreatePayslipTemplateDto = z.object({
  name: z.string().min(2).max(100),
  templateCode: z.string().min(1).max(50).toUpperCase(),
  layoutType: z.enum(["STANDARD", "COMPACT", "MODERN_GRID", "EXECUTIVE", "CUSTOM_HTML"]).optional().default("STANDARD"),
  isCompanyDefault: z.boolean().optional().default(false),
  sections: z.object({
    showCompanyLogo: z.boolean().optional().default(true),
    showCompanyCin: z.boolean().optional().default(true),
    showEmployeePhoto: z.boolean().optional().default(false),
    showDepartmentDesignation: z.boolean().optional().default(true),
    showPanUan: z.boolean().optional().default(true),
    showBankDetails: z.boolean().optional().default(true),
    showAttendanceSummary: z.boolean().optional().default(true),
    showLeaveBalances: z.boolean().optional().default(true),
    showYtdTaxSummary: z.boolean().optional().default(true),
    showEmployerContributions: z.boolean().optional().default(true),
    showNetPayInWords: z.boolean().optional().default(true),
    showDigitalSignatureBox: z.boolean().optional().default(true),
  }).optional(),
  customDisclaimerText: z.string().optional(),
  headerColorHex: z.string().optional(),
  accentColorHex: z.string().optional(),
  customCss: z.string().optional(),
  htmlTemplate: z.string().optional(),
});
export type CreatePayslipTemplateInput = z.infer<typeof CreatePayslipTemplateDto>;

export const SetPayslipTemplateDto = z.object({
  templateCode: z.string().min(1).toUpperCase(),
});
export type SetPayslipTemplateInput = z.infer<typeof SetPayslipTemplateDto>;

export const CreateBankPayoutConfigDto = z.object({
  name: z.string().min(2).max(100),
  bankCode: z.string().min(2).max(50).toUpperCase(),
  bankName: z.string().min(2).max(100),
  branchId: z.string().min(24).optional().nullable(),
  delimiter: z.string().min(1).default(","),
  fileExtension: z.enum(["csv", "txt", "tsv"]).default("csv"),
  mimeType: z.enum(["text/csv", "text/plain", "text/tab-separated-values"]).default("text/csv"),
  includeHeader: z.boolean().default(true),
  quoteStrings: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  columns: z.array(
    z.object({
      headerName: z.string().min(1),
      fieldSource: z.enum([
        "ACCOUNT_NUMBER",
        "NET_AMOUNT",
        "BENEFICIARY_NAME",
        "IFSC_CODE",
        "REMARKS",
        "EMAIL",
        "EMPLOYEE_CODE",
        "BANK_NAME",
        "BRANCH_NAME",
        "PAYMENT_DATE",
        "STATIC_VALUE",
      ]),
      staticValue: z.string().optional(),
      format: z.enum(["2_DECIMALS", "NO_DECIMALS", "YYYYMMDD", "DD/MM/YYYY", "RAW"]).optional(),
      fixedWidth: z.number().optional(),
      defaultValue: z.string().optional(),
    })
  ).min(1),
});
export type CreateBankPayoutConfigInput = z.infer<typeof CreateBankPayoutConfigDto>;




