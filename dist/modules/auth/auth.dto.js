"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.ChangePasswordDto = exports.RefreshTokenDto = exports.LoginDto = exports.RegisterDto = void 0;
const zod_1 = require("zod");
const common_validator_1 = require("../../core/validators/common.validator");
// Register DTO
exports.RegisterDto = zod_1.z.object({
    // Company details
    companyName: (0, common_validator_1.safeStringSchema)(2, 200),
    industry: (0, common_validator_1.safeStringSchema)(2, 100).optional(),
    // Admin user details
    firstName: (0, common_validator_1.safeStringSchema)(2, 100),
    lastName: (0, common_validator_1.safeStringSchema)(2, 100),
    email: common_validator_1.emailSchema,
    password: common_validator_1.passwordSchema,
    phone: common_validator_1.phoneSchema.optional(),
    // Locale
    countryCode: common_validator_1.countryCodeSchema.optional().default("IN"),
    timezone: zod_1.z.string().optional().default("Asia/Kolkata"),
});
// Login DTO
exports.LoginDto = zod_1.z.object({
    email: common_validator_1.emailSchema,
    password: zod_1.z.string().min(1, "Password is required"),
});
//Refresh token DTO
exports.RefreshTokenDto = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, "Refresh token is required"),
});
//Change password DTO
exports.ChangePasswordDto = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: common_validator_1.passwordSchema,
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
});
exports.ForgotPasswordDto = zod_1.z.object({
    email: common_validator_1.emailSchema,
});
exports.ResetPasswordDto = zod_1.z.object({
    token: zod_1.z.string().min(1, "Token is required"),
    password: common_validator_1.passwordSchema,
});
//# sourceMappingURL=auth.dto.js.map