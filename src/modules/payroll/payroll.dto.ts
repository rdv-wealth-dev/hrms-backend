import { z } from "zod";
import { objectIdSchema, safeStringSchema, countryCodeSchema } from "../../core/validators/common.validator";

//Salary Component
export const CreateSalaryComponentDto = z.object({
  name:            safeStringSchema(2, 100),
  code:            z.string().trim().toUpperCase().min(1).max(20),
  type:            z.enum(["EARNING", "DEDUCTION"]),
  calculationType: z.enum(["FLAT", "PERCENTAGE_OF", "FORMULA"]).optional().default("FLAT"),
  percentageOf:    z.string().trim().toUpperCase().optional(),
  percentageValue: z.number().min(0).max(100).optional(),
  isTaxable:       z.boolean().optional().default(true),
  isPartOfWages:   z.boolean().optional().default(true),
}).refine(
  (data) => data.calculationType !== "PERCENTAGE_OF" || (!!data.percentageOf && data.percentageValue !== undefined),
  { message: "percentageOf and percentageValue are required when calculationType is PERCENTAGE_OF" }
);

export type CreateSalaryComponentInput = z.infer<typeof CreateSalaryComponentDto>;

export const UpdateSalaryComponentDto = z.object({
  name:          safeStringSchema(2, 100).optional(),
  isTaxable:     z.boolean().optional(),
  isPartOfWages: z.boolean().optional(),
  isActive:      z.boolean().optional(),
});

export type UpdateSalaryComponentInput = z.infer<typeof UpdateSalaryComponentDto>;

//Salary Structure
export const CreateSalaryStructureDto = z.object({
  employeeId: objectIdSchema,
  ctcAnnual:  z.number().min(0),
  lineItems: z.array(z.object({
    componentCode: z.string().trim().toUpperCase(),
    amount:        z.number().min(0),
  })).min(1, "At least one salary component is required"),
});

export type CreateSalaryStructureInput = z.infer<typeof CreateSalaryStructureDto>;

//Payroll Run
export const CreatePayrollRunDto = z.object({
  month: z.number().min(1).max(12),
  year:  z.number().min(2020).max(2100),
});

export type CreatePayrollRunInput = z.infer<typeof CreatePayrollRunDto>;

export const ApprovePayrollRunDto = z.object({
  notes: safeStringSchema(0, 500).optional(),
});

export type ApprovePayrollRunInput = z.infer<typeof ApprovePayrollRunDto>;

// ── Attendance Lock ───────────────────────────────────────────────────────

export const AttendanceLockDto = z.object({
  year:  z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
});
export type AttendanceLockInput = z.infer<typeof AttendanceLockDto>;

export const AttendanceUnlockDto = z.object({
  year:   z.number().min(2020).max(2100),
  month:  z.number().min(1).max(12),
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
  ptAmount:  z.number().min(0),
});

export const UpsertPTConfigDto = z.object({
  stateCode:     z.string().trim().toUpperCase().length(2),
  stateName:     safeStringSchema(2, 100),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  slabs:         z.array(PTSlabDto).min(1, "At least one slab required"),
  frequency:     z.enum(["MONTHLY", "ANNUAL"]).optional().default("MONTHLY"),
});
export type UpsertPTConfigInput = z.infer<typeof UpsertPTConfigDto>;

// ── LWF Config ────────────────────────────────────────────────────────────

export const UpsertLWFConfigDto = z.object({
  stateCode:            z.string().trim().toUpperCase().length(2),
  stateName:            safeStringSchema(2, 100),
  financialYear:        z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  employeeContribution: z.number().min(0),
  employerContribution: z.number().min(0),
  deductionMonths:      z.array(z.number().min(1).max(12)).min(1),
});
export type UpsertLWFConfigInput = z.infer<typeof UpsertLWFConfigDto>;

// ── OT Config ─────────────────────────────────────────────────────────────

export const UpsertOTConfigDto = z.object({
  standardHoursPerDay:     z.number().min(1).max(24).optional(),
  otMultiplier:            z.number().min(1).max(5).optional(),
  holidayOtMultiplier:     z.number().min(1).max(5).optional(),
  maxOtHoursPerDay:        z.number().min(1).max(24).optional(),
  maxOtHoursPerWeek:       z.number().min(1).max(168).optional(),
  otEligibleEmployeeTypes: z.array(z.string()).optional(),
});
export type UpsertOTConfigInput = z.infer<typeof UpsertOTConfigDto>;

// ── Tax Declaration ───────────────────────────────────────────────────────

export const TaxDeclarationDto = z.object({
  financialYear:    z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY e.g. 2025-26"),
  regime:           z.enum(["OLD", "NEW"]).default("NEW"),
  // Old regime fields — ignored if regime = NEW
  rentPaidMonthly:  z.number().min(0).optional(),
  isMetroCity:      z.boolean().optional(),
  section80C:       z.number().min(0).max(150000).optional(),
  section80D:       z.number().min(0).max(50000).optional(),
  section80CCD1B:   z.number().min(0).max(50000).optional(),
  homeLoanInterest: z.number().min(0).max(200000).optional(),
  ltaAmount:        z.number().min(0).optional(),
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