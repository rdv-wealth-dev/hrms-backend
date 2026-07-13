import { z } from "zod";
import { objectIdSchema, safeStringSchema } from "../../core/validators/common.validator";

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