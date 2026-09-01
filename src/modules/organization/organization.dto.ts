import { z } from "zod";
import {
  safeStringSchema,
  urlSchema,
  countryCodeSchema,
  gstinSchema,
  panSchema,
} from "../../shared/validators/common.validator";

//Update Organization
export const UpdateOrganizationDto = z.object({
  companyName: safeStringSchema(2, 200).optional(),
  legalName: safeStringSchema(2, 300).optional(),
  industry: safeStringSchema(2, 100).optional(),
  employeeCountRange: z.string().optional(),
  teamSize: z.string().optional(),
  companySize: z.string().optional(),
  phone: z.string().trim().optional(),
  gstin: gstinSchema.optional(),
  pan: panSchema.optional(),
  cin: z.string().trim().uppercase().optional(),
  tan: z.string().trim().uppercase().optional(),

  address: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city: safeStringSchema(1, 100).optional(),
    state: safeStringSchema(1, 100).optional(),
    countryCode: countryCodeSchema.optional(),
    zip: z.string().trim().optional(),
  }).optional(),

  branding: z.object({
    logoUrl: urlSchema,
    primaryColor: z.string().trim().optional(),
    website: urlSchema,
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().trim().optional(),
  }).optional(),

  locale: z.object({
    timezone: z.string().trim().optional(),
    dateFormat: z.string().trim().optional(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    fiscalYearStart: z.string().trim().optional(),
    weeklyOffDays: z.array(z.string()).optional(),
    workingHoursPerDay: z.number().min(1).max(24).optional(),
    customWeekOffRules: z.array(
      z.object({
        dayOfWeek: z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
        weeks: z.array(z.number().int().min(1).max(5)).max(5),
      })
    ).optional(),
  }).optional(),

  employeeCodeConfig: z.object({
    prefix: z.string().trim().min(1).max(15).toUpperCase(),
    digits: z.number().int().min(1).max(8).optional().default(2),
    separator: z.string().max(3).optional().default(""),
    startSequenceNumber: z.number().int().min(1).optional(),
  }).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationDto>;

export const UpdateEmployeeCodeConfigDto = z.object({
  prefix: z.string().trim().min(1).max(15).toUpperCase(),
  digits: z.number().int().min(1).max(8).optional().default(2),
  separator: z.string().max(3).optional().default(""),
  startSequenceNumber: z.number().int().min(1).optional().default(1),
});
export type UpdateEmployeeCodeConfigInput = z.infer<typeof UpdateEmployeeCodeConfigDto>;

//Update Modules
export const UpdateModulesDto = z.object({
  attendance: z.boolean().optional(),
  leave: z.boolean().optional(),
  payroll: z.boolean().optional(),
  performance: z.boolean().optional(),
  recruitment: z.boolean().optional(),
  assets: z.boolean().optional(),
});

export type UpdateModulesInput = z.infer<typeof UpdateModulesDto>;

// Update Statutory
export const UpdateStatutoryDto = z.object({
  pfEnabled: z.boolean().optional(),
  esiEnabled: z.boolean().optional(),
  tdsEnabled: z.boolean().optional(),
  ptEnabled: z.boolean().optional(),
  lwfEnabled: z.boolean().optional(),
});

export type UpdateStatutoryInput = z.infer<typeof UpdateStatutoryDto>;


export const UpdateMandatoryDocsDto = z.object({
  mandatoryDocumentTypes: z.array(z.enum([
    "PAN", "AADHAAR", "PASSPORT", "DRIVING_LICENSE",
    "OFFER_LETTER", "RESUME", "DEGREE", "EXPERIENCE", "OTHER"
  ])).min(0),
});
export type UpdateMandatoryDocsInput = z.infer<typeof UpdateMandatoryDocsDto>;