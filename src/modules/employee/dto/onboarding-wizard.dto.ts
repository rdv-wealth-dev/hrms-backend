import { z } from "zod";
import { safeStringSchema, dateSchema, phoneSchema, emailSchema } from "../../../shared/validators/index";

export const EducationDetailDto = z.object({
  qualificationLevel: z.enum([
    "DOCTORATE",
    "POST_GRADUATE",
    "UNDER_GRADUATE",
    "DIPLOMA",
    "HIGHER_SECONDARY",
    "SECONDARY",
    "OTHER",
  ]),
  degree: safeStringSchema(1, 150),
  fieldOfStudy: safeStringSchema(0, 100).optional(),
  institutionName: safeStringSchema(1, 200),
  yearOfPassing: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1950).max(2100).optional()),
  percentageOrCgpa: safeStringSchema(0, 50).optional(),
  boardCode: safeStringSchema(0, 50).optional(),
  stateBoardState: safeStringSchema(0, 100).optional(),
  otherBoardName: safeStringSchema(0, 150).optional(),
});

export const OnboardingStep1Dto = z.object({
  dateOfBirth: dateSchema.optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  religion: z.enum([
    "HINDUISM",
    "ISLAM",
    "CHRISTIANITY",
    "SIKHISM",
    "BUDDHISM",
    "JAINISM",
    "ZOROASTRIANISM",
    "JUDAISM",
    "OTHER",
    "PREFER_NOT_TO_SAY"
  ]).optional(),
  phone: phoneSchema.optional(),
  fatherName: safeStringSchema(0, 100).optional(),
  fatherPhone: phoneSchema.optional(),
  motherName: safeStringSchema(0, 100).optional(),
  motherPhone: phoneSchema.optional(),
  highestQualification: z.enum([
    "DOCTORATE",
    "POST_GRADUATE",
    "UNDER_GRADUATE",
    "DIPLOMA",
    "HIGHER_SECONDARY",
    "SECONDARY",
    "OTHER",
  ]).optional(),
  educationDetails: z.array(EducationDetailDto).optional(),
  currentAddress: z.object({
    addressLine1: safeStringSchema(1, 200),
    addressLine2: safeStringSchema(0, 200).optional(),
    city: safeStringSchema(1, 100),
    state: safeStringSchema(1, 100),
    countryCode: z.string().length(2).toUpperCase(),
    zip: z.string().trim().min(4).max(10),
  }).optional(),
  emergencyContact: z.array(z.object({
    name: safeStringSchema(2, 100),
    relationship: safeStringSchema(2, 50),
    phone: phoneSchema,
    email: emailSchema.optional(),
  })).min(1, "At least one emergency contact is required").optional(),
  pan: z.string().trim().optional(),
  aadhaar: z.string().trim().optional(),
  passportNo: z.string().trim().optional(),
  previousEmployerName: safeStringSchema(0, 100).optional(),
  previousEmployerLastWorkingDate: dateSchema.optional(),
  customFields: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => {
    if (data.previousEmployerName && data.previousEmployerName.trim().length > 0) {
      return !!data.previousEmployerLastWorkingDate;
    }
    return true;
  },
  {
    message: "Last working day is required when previous employer name is provided",
    path: ["previousEmployerLastWorkingDate"],
  }
);

export type OnboardingStep1Input = z.infer<typeof OnboardingStep1Dto>;

// Step 2 — Family Details
export const FamilyMemberDto = z.object({
  fullName: safeStringSchema(2, 100),
  relationship: z.enum(["SPOUSE", "CHILD", "FATHER", "MOTHER", "SIBLING", "OTHER"]),
  dateOfBirth: dateSchema.optional(),
  gender: z.string().trim().optional(),
  isDependent: z.boolean().optional().default(true),
  occupation: safeStringSchema(0, 100).optional(),
  phone: phoneSchema.optional(),
  isNominee: z.boolean().optional().default(false),
});

export const OnboardingStep2Dto = z.object({
  familyMembers: z.array(FamilyMemberDto).optional().default([]),
  isNotApplicable: z.boolean().optional().default(false),
  isNa: z.boolean().optional(),
  hasNoFamily: z.boolean().optional(),
}).refine(
  (data) => {
    const isNa = !!(data.isNotApplicable || data.isNa || data.hasNoFamily);
    if (isNa) return true;
    return Array.isArray(data.familyMembers) && data.familyMembers.length > 0;
  },
  {
    message: "Please add at least one family member or check 'Not Applicable' (NA) to proceed.",
    path: ["familyMembers"],
  }
);
export type OnboardingStep2Input = z.infer<typeof OnboardingStep2Dto>;

// Step 3 — Bank Details 
export const OnboardingStep3Dto = z.object({
  bankName: safeStringSchema(2, 200).optional(),
  accountNumber: z.string().trim().min(8).max(20).optional(),
  ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
  accountType: z.enum(["SAVINGS", "CURRENT", "SALARY"]).optional().default("SALARY"),
});
export type OnboardingStep3Input = z.infer<typeof OnboardingStep3Dto>;

// Step 4 — Documents — no body needed, checked against what's uploaded 
// (uses existing /employees/me/documents/* routes — step 4 just checks completion)

// Step 5 — Review & Submit — no body needed (review is aggregated from previous steps)

export const SkipStepDto = z.object({
  step: z.number().int().min(1).max(4).optional(),
});
export type SkipStepInput = z.infer<typeof SkipStepDto>;

export const NavigateStepDto = z.object({
  step: z.number().int().min(1).max(5),
});
export type NavigateStepInput = z.infer<typeof NavigateStepDto>;
export const OnboardingStep5Dto = z.object({
  confirmed: z.literal(true).refine((v) => v === true, {
    message: "You must confirm to complete onboarding",
  }),
});
export type OnboardingStep5Input = z.infer<typeof OnboardingStep5Dto>;