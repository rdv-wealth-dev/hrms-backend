import { z } from "zod";

export const LoanTypeEnum = z.enum([
  "SALARY_ADVANCE",
  "PERSONAL_LOAN",
  "EMERGENCY_LOAN",
  "FESTIVAL_ADVANCE",
  "EDUCATION_LOAN",
  "EQUIPMENT_PURCHASE",
  "OTHER",
]);

export const LoanStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);

export const DisbursementMethodEnum = z.enum([
  "PAYROLL_ADDITION",
  "BANK_TRANSFER",
  "CHEQUE",
  "CASH",
]);

export const CreateLoanDto = z.object({
  employeeId: z.string().min(24).optional(), // optional when employee self-applies
  loanType: LoanTypeEnum.optional().default("SALARY_ADVANCE"),
  principalAmount: z.number().positive("Principal amount must be greater than zero"),
  interestRateAnnualPercent: z.number().min(0).max(100).optional().default(0),
  tenureMonths: z.number().int().min(1).max(120),
  monthlyEmi: z.number().positive().optional(),
  disbursementMethod: DisbursementMethodEnum.optional().default("BANK_TRANSFER"),
  disbursementDate: z.string().datetime().optional(),
  repaymentStartYear: z.number().int().min(2020).max(2100).optional(),
  repaymentStartMonth: z.number().int().min(1).max(12).optional(),
  reason: z.string().max(500).optional(),
});
export type CreateLoanInput = z.infer<typeof CreateLoanDto>;

export const UpdateLoanDto = z.object({
  monthlyEmi: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
  reason: z.string().max(500).optional(),
  approverNotes: z.string().max(500).optional(),
});
export type UpdateLoanInput = z.infer<typeof UpdateLoanDto>;

export const ApproveLoanDto = z.object({
  approverNotes: z.string().max(500).optional(),
  disbursementMethod: DisbursementMethodEnum.optional(),
  disbursementDate: z.string().datetime().optional(),
  repaymentStartYear: z.number().int().min(2020).max(2100).optional(),
  repaymentStartMonth: z.number().int().min(1).max(12).optional(),
  customMonthlyEmi: z.number().positive().optional(),
});
export type ApproveLoanInput = z.infer<typeof ApproveLoanDto>;

export const RejectLoanDto = z.object({
  reason: z.string().min(2).max(500),
});
export type RejectLoanInput = z.infer<typeof RejectLoanDto>;

export const ListLoansQueryDto = z.object({
  employeeId: z.string().optional(),
  status: LoanStatusEnum.optional(),
  loanType: LoanTypeEnum.optional(),
  pageNumber: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type ListLoansQueryInput = z.infer<typeof ListLoansQueryDto>;
