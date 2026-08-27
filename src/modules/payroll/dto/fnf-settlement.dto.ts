import { z } from "zod";
import { FnFStatus, LeavingReason } from "../models/fnf-settlement.model";

export const ComputeFnFDto = z.object({
  lastWorkingDay: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid last working day format (YYYY-MM-DD)",
  }),
  resignationDate: z.string().optional(),
  leavingReason: z.nativeEnum(LeavingReason).optional().default(LeavingReason.RESIGNED),
  noticePeriodDays: z.coerce.number().int().min(0).optional().default(30),
  noticeServedDays: z.coerce.number().int().min(0).optional(),
  bonusAmount: z.coerce.number().min(0).optional().default(0),
  assetDamageRecovery: z.coerce.number().min(0).optional().default(0),
  otherEarnings: z.coerce.number().min(0).optional().default(0),
  otherDeductions: z.coerce.number().min(0).optional().default(0),
});

export type ComputeFnFInput = z.infer<typeof ComputeFnFDto>;

export const ProcessFnFDto = z.object({
  lastWorkingDay: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid last working day format (YYYY-MM-DD)",
  }),
  resignationDate: z.string().optional(),
  leavingReason: z.nativeEnum(LeavingReason).optional().default(LeavingReason.RESIGNED),
  noticePeriodDays: z.coerce.number().int().min(0).optional().default(30),
  noticeServedDays: z.coerce.number().int().min(0).optional(),
  bonusAmount: z.coerce.number().min(0).optional().default(0),
  assetDamageRecovery: z.coerce.number().min(0).optional().default(0),
  otherEarnings: z.coerce.number().min(0).optional().default(0),
  otherDeductions: z.coerce.number().min(0).optional().default(0),
  approvalNotes: z.string().max(500).optional(),
});

export type ProcessFnFInput = z.infer<typeof ProcessFnFDto>;

export const FnFQueryDto = z.object({
  status: z.nativeEnum(FnFStatus).optional(),
  employeeId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type FnFQueryInput = z.infer<typeof FnFQueryDto>;
