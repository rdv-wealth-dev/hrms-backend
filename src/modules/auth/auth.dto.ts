import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  safeStringSchema,
  countryCodeSchema,
  withPhoneValidation,
  workspaceSlugSchema,
  currencyCodeSchema,
} from "../../core/validators/common.validator";

// Helper to convert empty string inputs to undefined so that optional schema fields work correctly
function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (val) => (val === "" ? undefined : val),
    schema.optional()
  ) as unknown as z.ZodType<z.infer<T> | undefined, any, any>;
}

// Register DTO
export const RegisterDto = z.object({
  firstName: safeStringSchema(2, 100),
  lastName: safeStringSchema(2, 100),
  email: emailSchema,
  password: passwordSchema.max(12, "Password must not exceed 12 characters"),
  companyName: safeStringSchema(2, 200),
  workspaceSlug: workspaceSlugSchema,
});

export type RegisterInput = z.infer<typeof RegisterDto>;

// Login DTO
export const LoginDto = z.object({
  email:          emailSchema,
  password:       z.string().min(1, "Password is required"),
  rememberDevice: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginDto>;

//Refresh token DTO
export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenDto>;

//Change password DTO
export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path: ["newPassword"],
  }
);

export type ChangePasswordInput = z.infer<typeof ChangePasswordDto>;

export const ForgotPasswordDto = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordDto>;

export const ResetPasswordDto = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordDto>;

export const VerifyEmailDto = z.object({
  token: z.string().min(1, "Verification token is required"),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailDto>;

// Workspace slug availability check — called real-time as user types
export const CheckSlugDto = z.object({
  slug: workspaceSlugSchema,
});
export type CheckSlugInput = z.infer<typeof CheckSlugDto>;

// Step 2 onboarding wizard — submitted AFTER account is created
export const OnboardingWizardDto = z.object({
  countryCode: countryCodeSchema,
  timezone: z.string().min(1, "Timezone is required"),
  employeeCountRange: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]),
  industry: safeStringSchema(2, 100),
  phone: phoneSchema,
  baseCurrency: optionalString(currencyCodeSchema),  // auto-filled from country, but overridable
  fiscalYearStart: z.enum([
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
  ]).default("April"),
  adminJobTitle: optionalString(z.string().min(1, "Job title cannot be empty")),
});
export type OnboardingWizardInput = z.infer<typeof OnboardingWizardDto>;

// Activate Account

export const ActivateAccountDto = z.object({
  token: z.string().min(1, "Activation token is required"),
  password: passwordSchema,
}).refine(
  (data) => data.password.length >= 8,
  { message: "Password must be at least 8 characters long", path: ["password"] }
);

export type ActivateAccountInput = z.infer<typeof ActivateAccountDto>;

export const ResendVerificationEmailDto = z.object({
  email: emailSchema,
});
export type ResendVerificationEmailInput = z.infer<typeof ResendVerificationEmailDto>;

// Check email — SSO detection + workspace branding (called as user finishes typing email)
export const CheckEmailDto = z.object({
  email: z.string().email("Invalid email").toLowerCase().trim(),
});
export type CheckEmailInput = z.infer<typeof CheckEmailDto>;