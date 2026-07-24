import { z } from "zod";
import {
  safeStringSchema,
  objectIdSchema,
  dateSchema,
} from "../../core/validators/common.validator";

//Leave Type DTOs
export const CreateLeaveTypeDto = z.object({
  name:                  safeStringSchema(2, 100),
  code:                  z.string().trim().toUpperCase().min(1).max(10),
  description:           safeStringSchema(0, 500).optional().default(""),
  isPaid:                z.boolean().optional().default(true),
  annualQuota:           z.number().min(0),
  branchOverrides: z.array(z.object({
    branchId:    objectIdSchema,
    annualQuota: z.number().min(0),
  })).optional().default([]),
  accrualFrequency:      z.enum([
    "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY",
    "WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "DAILY", "HOURLY",
    "ON_JOINING", "MANUAL", "NONE"
  ]).optional().default("NONE"),
  accrualAmountPerCycle: z.number().min(0).optional().default(0),
  maxCarryForwardDays:   z.number().min(0).optional().default(0),
  maxConsecutiveDays:    z.number().min(0).optional().default(0),
  advanceNoticeDays:     z.number().min(0).optional().default(0),
  minAdvanceNoticeDays:  z.number().min(0).optional().default(0),
  requiresApproval:      z.boolean().optional().default(true),
  approvalLevels:        z.number().min(1).max(3).optional().default(1),
  allowNegativeBalance:  z.boolean().optional().default(false),
  probationEligible:     z.boolean().optional().default(false),
  applySandwichPolicy:   z.boolean().optional().default(false),
});

export type CreateLeaveTypeInput = z.infer<typeof CreateLeaveTypeDto>;

export const UpdateLeaveTypeDto = CreateLeaveTypeDto.partial();
export type UpdateLeaveTypeInput = z.infer<typeof UpdateLeaveTypeDto>;

//Leave Request DTOs
export const CreateLeaveRequestDto = z.object({
  leaveTypeId: objectIdSchema,
  fromDate:    dateSchema,
  toDate:      dateSchema,
  fromSession: z.enum(["FULL_DAY", "FIRST_HALF", "SECOND_HALF"]).optional().default("FULL_DAY"),
  toSession:   z.enum(["FULL_DAY", "FIRST_HALF", "SECOND_HALF"]).optional().default("FULL_DAY"),
  reason:      safeStringSchema(5, 500),
});

export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestDto>;

export const ReviewLeaveRequestDto = z.object({
  status:         z.enum(["APPROVED", "REJECTED"]),
  reviewComments: safeStringSchema(0, 500).optional(),
});

export type ReviewLeaveRequestInput = z.infer<typeof ReviewLeaveRequestDto>;

export const CancelLeaveRequestDto = z.object({
  cancelReason: safeStringSchema(5, 500),
});

export type CancelLeaveRequestInput = z.infer<typeof CancelLeaveRequestDto>;

//Holiday DTOs
export const CreateHolidayDto = z.object({
  name:        safeStringSchema(2, 200),
  date:        dateSchema,
  type:        z.enum(["NATIONAL", "RESTRICTED", "REGIONAL"]).optional().default("NATIONAL"),
  isOptional:  z.boolean().optional().default(false),
  description: safeStringSchema(0, 500).optional(),
  branchId:    objectIdSchema.optional(),   // if omitted, applies org-wide
});

export type CreateHolidayInput = z.infer<typeof CreateHolidayDto>;

export const UpdateHolidayDto = CreateHolidayDto.partial();
export type UpdateHolidayInput = z.infer<typeof UpdateHolidayDto>;

//Query DTOs
export const LeaveReportQueryDto = z.object({
  fromDate:    dateSchema.optional(),
  toDate:      dateSchema.optional(),
  employeeId:  objectIdSchema.optional(),
  leaveTypeId: objectIdSchema.optional(),
  status:      z.enum(["PENDING","APPROVED","REJECTED","CANCELLED"]).optional(),
  pageNumber:  z.string().optional().transform(v => v ? parseInt(v) : 1),
  pageSize:    z.string().optional().transform(v => v ? parseInt(v) : 20),
});

export type LeaveReportQuery = z.infer<typeof LeaveReportQueryDto>;