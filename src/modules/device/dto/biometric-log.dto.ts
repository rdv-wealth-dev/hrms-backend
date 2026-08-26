import { z } from "zod";

export const BiometricLogQueryDto = z.object({
  period: z.enum(["today", "this_week", "this_month", "last_month", "custom"]).optional().default("today"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  employeeCode: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  branchId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  modeofPunch: z.string().trim().optional(),
  deviceSerialno: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(20),
  pageNumber: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export type BiometricLogQueryInput = z.infer<typeof BiometricLogQueryDto>;
