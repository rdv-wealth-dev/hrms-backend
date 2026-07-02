import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  safeStringSchema,
  countryCodeSchema,
} from "../../core/validators/common.validator";

// Register DTO
export const RegisterDto = z.object({
  // Company details
  companyName: safeStringSchema(2, 200),
  industry:    safeStringSchema(2, 100).optional(),

  // Admin user details
  firstName: safeStringSchema(2, 100),
  lastName:  safeStringSchema(2, 100),
  email:     emailSchema,
  password:  passwordSchema,
  phone:     phoneSchema.optional(),

  // Locale — detected from browser and sent by frontend
  countryCode: countryCodeSchema,
  timezone:    z.string().min(1, "Timezone is required"),
});

export type RegisterInput = z.infer<typeof RegisterDto>;

// Login DTO
export const LoginDto = z.object({
  email:    emailSchema,
  password: z.string().min(1, "Password is required"),
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
  newPassword:     passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path:    ["newPassword"],
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

// Activate Account

export const ActivateAccountDto = z.object({
  token : z.string().min(1, "Activation token is required"),
  password : passwordSchema,
}).refine(
  (data) => data.password.length >= 8,
  {message : "Password must be at least 8 characters long", path : ["password"]}
);

export type ActivateAccountInput = z.infer<typeof ActivateAccountDto>;