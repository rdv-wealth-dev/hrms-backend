import { z } from "zod";
import { ArrearsBatchStatus } from "../models/arrears-batch.model";

export const ArrearsBatchLineDto = z.object({
  employeeId: z.string().trim().min(1, "employeeId is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  remarks: z.string().max(300).optional(),
});

export const CreateArrearsBatchDto = z.object({
  batchName: z.string().min(3, "Batch name must be at least 3 characters").max(150),
  reason: z.string().min(3, "Reason is required").max(500),
  effectiveYear: z.coerce.number().int().min(2020).max(2050).optional(),
  effectiveMonth: z.coerce.number().int().min(1).max(12).optional(),
  lines: z.array(ArrearsBatchLineDto).min(1, "At least one employee line is required"),
});

export type CreateArrearsBatchInput = z.infer<typeof CreateArrearsBatchDto>;

export const ProcessArrearsBatchDto = z.object({
  targetYear: z.coerce.number().int().min(2020).max(2050).optional(),
  targetMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type ProcessArrearsBatchInput = z.infer<typeof ProcessArrearsBatchDto>;

export const ArrearsBatchQueryDto = z.object({
  status: z.nativeEnum(ArrearsBatchStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ArrearsBatchQueryInput = z.infer<typeof ArrearsBatchQueryDto>;
