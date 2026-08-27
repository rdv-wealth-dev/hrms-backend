import { z } from "zod";
import { ReimbursementCategory, ReimbursementStatus } from "../models/reimbursement.model";

export const CreateReimbursementDto = z.object({
  employeeId: z.string().trim().optional(), // If omitted, resolved from logged-in employee
  category: z.nativeEnum(ReimbursementCategory).default(ReimbursementCategory.GENERAL),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid expense date",
  }),
  receiptUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  receiptFileName: z.string().optional(),
  remarks: z.string().max(300).optional(),
});

export type CreateReimbursementInput = z.infer<typeof CreateReimbursementDto>;

export const UpdateReimbursementDto = z.object({
  category: z.nativeEnum(ReimbursementCategory).optional(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().positive().optional(),
  expenseDate: z.string().optional(),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  receiptFileName: z.string().optional(),
  remarks: z.string().max(300).optional(),
});

export type UpdateReimbursementInput = z.infer<typeof UpdateReimbursementDto>;

export const ApproveReimbursementDto = z.object({
  approvedAmount: z.coerce.number().positive("Approved amount must be positive").optional(),
  remarks: z.string().max(300).optional(),
});

export type ApproveReimbursementInput = z.infer<typeof ApproveReimbursementDto>;

export const RejectReimbursementDto = z.object({
  reason: z.string().min(3, "Rejection reason must be at least 3 characters").max(300),
});

export type RejectReimbursementInput = z.infer<typeof RejectReimbursementDto>;

export const ReimbursementQueryDto = z.object({
  status: z.nativeEnum(ReimbursementStatus).optional(),
  category: z.nativeEnum(ReimbursementCategory).optional(),
  employeeId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ReimbursementQueryInput = z.infer<typeof ReimbursementQueryDto>;
