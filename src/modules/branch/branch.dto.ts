import { z } from "zod";
import {safeStringSchema, countryCodeSchema, } from "../../core/validators/common.validator";
import { SaturdayOffMode } from "../attendance/schedule-engine";

//Create Branch
export const CreateBranchDto = z.object({
  name: safeStringSchema(2, 200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must not exceed 20 characters"),

  parentBranchId: z.string().optional(),

  address: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    landmark:     safeStringSchema(1, 100).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  countryCodeSchema.optional(),
    zip:          z.string().trim().optional(),
  }).optional(),

  contact: z.object({
    phone: z.string().trim().optional(),
    email: z.string().email().optional(),
  }).optional(),

  geo: z.object({
    lat:                  z.number().optional(),
    lng:                  z.number().optional(),
    geofenceRadiusMeters: z.number().min(50).max(5000).optional(),
    geofenceEnabled:      z.boolean().optional(),
  }).optional(),

  workPolicy: z.object({
    timezone:           z.string().optional(),
    weeklyOffDays:      z.array(z.string()).optional(),
    shiftStartTime:     z.string().optional(),
    shiftEndTime:       z.string().optional(),
    workingHoursPerDay: z.number().min(1).max(24).optional(),
    saturdayPolicy: z.object({
      mode:           z.nativeEnum(SaturdayOffMode),
      customOffWeeks: z.array(z.number().int().min(1).max(5)).max(5).optional(),
    }).optional(),
    customWeekOffRules: z.array(
      z.object({
        dayOfWeek: z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
        weeks:     z.array(z.number().int().min(1).max(5)).max(5),
      })
    ).optional(),
  }).optional(),

  statutory: z.object({
    pfApplicable:  z.boolean().nullable().optional(),
    esiApplicable: z.boolean().nullable().optional(),
    ptApplicable:  z.boolean().nullable().optional(),
    ptStateCode:   z.string().optional(),
  }).optional(),
});

export type CreateBranchInput = z.infer<typeof CreateBranchDto>;

//Update Branch
export const UpdateBranchDto = CreateBranchDto.partial();
export type UpdateBranchInput = z.infer<typeof UpdateBranchDto>;