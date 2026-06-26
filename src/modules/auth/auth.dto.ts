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

  // Locale
  countryCode: countryCodeSchema.optional().default("IN"),
  timezone:    z.string().optional().default("Asia/Kolkata"),
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