import { z } from "zod";
import {
  safeStringSchema,
  urlSchema,
  countryCodeSchema,
  gstinSchema,
  panSchema,
} from "../../core/validators/common.validator";

//Update Organization
export const UpdateOrganizationDto = z.object({
  companyName: safeStringSchema(2, 200).optional(),
  legalName:   safeStringSchema(2, 300).optional(),
  industry:    safeStringSchema(2, 100).optional(),
  phone:       z.string().trim().optional(),
  gstin:       gstinSchema.optional(),
  pan:         panSchema.optional(),
  cin:         z.string().trim().uppercase().optional(),
  tan:         z.string().trim().uppercase().optional(),

  address: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  countryCodeSchema.optional(),
    zip:          z.string().trim().optional(),
  }).optional(),

  branding: z.object({
    logoUrl:      urlSchema,
    primaryColor: z.string().trim().optional(),
    website:      urlSchema,
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().trim().optional(),
  }).optional(),

  locale: z.object({
    timezone:           z.string().trim().optional(),
    dateFormat:         z.string().trim().optional(),
    timeFormat:         z.enum(["12h", "24h"]).optional(),
    fiscalYearStart:    z.string().trim().optional(),
    weeklyOffDays:      z.array(z.string()).optional(),
    workingHoursPerDay: z.number().min(1).max(24).optional(),
  }).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationDto>;

//Update Modules
export const UpdateModulesDto = z.object({
  attendance:  z.boolean().optional(),
  leave:       z.boolean().optional(),
  payroll:     z.boolean().optional(),
  performance: z.boolean().optional(),
  recruitment: z.boolean().optional(),
  assets:      z.boolean().optional(),
});

export type UpdateModulesInput = z.infer<typeof UpdateModulesDto>;

// Update Statutory
export const UpdateStatutoryDto = z.object({
  pfEnabled:  z.boolean().optional(),
  esiEnabled: z.boolean().optional(),
  tdsEnabled: z.boolean().optional(),
  ptEnabled:  z.boolean().optional(),
  lwfEnabled: z.boolean().optional(),
});

export type UpdateStatutoryInput = z.infer<typeof UpdateStatutoryDto>;


export const UpdateMandatoryDocsDto = z.object({
  mandatoryDocumentTypes: z.array(z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ])).min(0),
});
export type UpdateMandatoryDocsInput = z.infer<typeof UpdateMandatoryDocsDto>;