import { z } from "zod";
import { safeStringSchema, dateSchema, phoneSchema, emailSchema } from "../../core/validators";

export const OnboardingStep1Dto = z.object({
    dateOfBirth : dateSchema,
    gender : z.enum(["MALE","FEMALE","OTHERS"]),
    bloodGroup : z.enum(["A+","A-","B+","B-","O+","O-","AB+","AB-"]).optional(),
    maritalStatus : z.enum(["SINGLE","MARRIED","DIVORCED","WIDOWED"]),
    phone : phoneSchema,
    currentAddress : z.object({
        addressLine1: safeStringSchema(1, 200),
        addressLine2: safeStringSchema(0, 200).optional(),
        city:         safeStringSchema(1, 100),
        state:        safeStringSchema(1, 100),
        countryCode:  z.string().length(2).toUpperCase(),
        zip:          z.string().trim().min(4).max(10),
    }),
    emergencyContact : z.array(z.object({
        name : safeStringSchema(2,100),
        relationship : safeStringSchema(2,50),
        phone : phoneSchema,
        email : emailSchema.optional(),
    })).min(1,"At least one emergency contact is required"),
});

export type OnboardingStep1Input = z.infer<typeof OnboardingStep1Dto>;

// Step 2 — Family Details
export const FamilyMemberDto = z.object({
  fullName:     safeStringSchema(2, 100),
  relationship: z.enum(["SPOUSE","CHILD","FATHER","MOTHER","SIBLING","OTHER"]),
  dateOfBirth:  dateSchema.optional(),
  gender:       z.string().trim().optional(),
  isDependent:  z.boolean().optional().default(true),
  occupation:   safeStringSchema(0, 100).optional(),
  phone:        phoneSchema.optional(),
  isNominee:    z.boolean().optional().default(false),
});

export const OnboardingStep2Dto = z.object({
  familyMembers: z.array(FamilyMemberDto).min(0), // allow empty — single employees with no dependents
});
export type OnboardingStep2Input = z.infer<typeof OnboardingStep2Dto>;

// Step 3 — Bank Details 
export const OnboardingStep3Dto = z.object({
  bankName:      safeStringSchema(2, 200),
  accountNumber: z.string().trim().min(8).max(20),
  ifscCode:      z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  accountType:   z.enum(["SAVINGS","CURRENT","SALARY"]).optional().default("SALARY"),
});
export type OnboardingStep3Input = z.infer<typeof OnboardingStep3Dto>;

// Step 4 — Documents — no body needed, checked against what's uploaded ────
// (uses existing /employees/me/documents/* routes — step 4 just checks completion)

// Step 5 — Review & Submit
export const OnboardingStep5Dto = z.object({
  confirmed: z.literal(true).refine((v) => v === true, {
    message: "You must confirm to complete onboarding",
  }),
});
export type OnboardingStep5Input = z.infer<typeof OnboardingStep5Dto>;