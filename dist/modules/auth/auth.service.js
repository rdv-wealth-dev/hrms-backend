"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const mongoose_1 = __importDefault(require("mongoose"));
const user_repository_1 = require("../user/user.repository");
const organization_repository_1 = require("../organization/organization.repository");
const branch_repository_1 = require("../branch/branch.repository");
const user_model_1 = require("../user/user.model");
const role_model_1 = require("../role/role.model");
const role_seed_1 = require("../role/role.seed");
const crypto_1 = __importDefault(require("crypto"));
const email_service_1 = require("../../service/email.service");
const env_1 = require("../../config/env");
const app_error_1 = require("../../core/errors/app.error");
// CONSTANTS
const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
// HELPERS
function generateSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}
function signAccessToken(payload) {
    const jti = (0, uuid_1.v4)();
    return jsonwebtoken_1.default.sign({ ...payload, jti }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}
function signRefreshToken(userId, tenantId) {
    return jsonwebtoken_1.default.sign({ userId, tenantId, jti: (0, uuid_1.v4)() }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}
// AUTH SERVICE
class AuthService {
    userRepo = new user_repository_1.UserRepository();
    orgRepo = new organization_repository_1.OrganizationRepository();
    branchRepo = new branch_repository_1.BranchRepository();
    //Register
    async register(input) {
        // 1. Check if email already exists globally
        const existingUser = await this.userRepo.findByEmail(input.email);
        if (existingUser) {
            throw new app_error_1.AppError("Email already registered", 409);
        }
        // 2. Generate slug
        let slug = generateSlug(input.companyName);
        const slugTaken = await this.orgRepo.slugExists(slug);
        if (slugTaken) {
            slug = `${slug}-${Date.now()}`;
        }
        // 3. Create organization
        const organization = await this.orgRepo.create({
            companyName: input.companyName,
            slug,
            industry: input.industry,
            locale: {
                countryCode: input.countryCode ?? "IN",
                timezone: input.timezone ?? "Asia/Kolkata",
                currencyCode: "INR",
                dateFormat: "DD/MM/YYYY",
                timeFormat: "12h",
                fiscalYearStart: "April",
                weeklyOffDays: ["Saturday", "Sunday"],
                workingHoursPerDay: 8,
            },
            subscription: {
                plan: "free",
                status: "trial",
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                maxEmployees: 10,
                maxBranches: 1,
            },
            modules: {
                attendance: true,
                leave: true,
                payroll: false,
                performance: false,
                recruitment: false,
                assets: false,
            },
            statutory: {
                pfEnabled: false,
                esiEnabled: false,
                tdsEnabled: true,
                ptEnabled: false,
                lwfEnabled: false,
            },
        });
        const tenantId = organization._id.toString();
        const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
        // 4. Create Head Office branch
        const headOffice = await this.branchRepo.create({
            tenantId: tenantObjectId,
            branchId: tenantObjectId,
            name: "Head Office",
            code: "HQ",
            isHeadOffice: true,
            isActive: true,
            address: {
                countryCode: input.countryCode ?? "IN",
            },
            workPolicy: {
                timezone: input.timezone ?? "Asia/Kolkata",
                weeklyOffDays: ["Saturday", "Sunday"],
                workingHoursPerDay: 8,
            },
        });
        // 5. Hash password
        const passwordHash = await bcrypt_1.default.hash(input.password, BCRYPT_SALT_ROUNDS);
        // 6. Seed default roles for this tenant
        const roleMap = await (0, role_seed_1.seedDefaultRoles)(tenantId, "system");
        // 7. Get SUPER_ADMIN permissions from seeded role
        const superAdminRole = await role_model_1.RoleModel.findOne({
            tenantId: tenantObjectId, // ← ObjectId not string
            slug: "SUPER_ADMIN",
            isDeleted: false,
        }).select("permissions");
        const superAdminPermissions = superAdminRole?.permissions ?? [];
        // 8. Create super admin user
        const superAdmin = await new user_model_1.UserModel({
            tenantId: tenantObjectId,
            email: input.email.toLowerCase(),
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            role: "SUPER_ADMIN",
            isSuperAdmin: true,
            isActive: true,
            isEmailVerified: false,
            branchIds: [],
            permissions: [],
        }).save();
        // 9. Build JWT payload
        const jwtPayload = {
            tenantId: tenantId,
            userId: superAdmin._id.toString(),
            role: "SUPER_ADMIN",
            branchIds: [],
            permissions: superAdminPermissions,
        };
        // 10. Sign tokens
        const accessToken = signAccessToken(jwtPayload);
        const refreshToken = signRefreshToken(superAdmin._id.toString(), tenantId);
        // 11. Update last login
        await this.userRepo.updateLastLogin(superAdmin._id.toString());
        // 12. Return response
        return {
            accessToken,
            refreshToken,
            user: {
                id: superAdmin._id,
                email: superAdmin.email,
                firstName: superAdmin.firstName,
                lastName: superAdmin.lastName,
                role: superAdmin.role,
                isSuperAdmin: superAdmin.isSuperAdmin,
                branchIds: superAdmin.branchIds,
            },
            organization: {
                id: organization._id,
                companyName: organization.companyName,
                slug: organization.slug,
                subscription: organization.subscription,
                modules: organization.modules,
            },
            branch: {
                id: headOffice._id,
                name: headOffice.name,
                code: headOffice.code,
            },
        };
    }
    // Login
    async login(input) {
        // 1. Find user by email
        const user = await this.userRepo.findByEmail(input.email);
        if (!user) {
            throw new app_error_1.AppError("Invalid email or password", 401);
        }
        // 2. Check account is active
        if (!user.isActive) {
            throw new app_error_1.AppError("Account is deactivated. Contact your administrator.", 401);
        }
        // 3. Compare password
        const isPasswordValid = await bcrypt_1.default.compare(input.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new app_error_1.AppError("Invalid email or password", 401);
        }
        // 4. Load permissions dynamically from roles collection
        const role = await role_model_1.RoleModel.findOne({
            tenantId: new mongoose_1.default.Types.ObjectId(user.tenantId.toString()),
            slug: user.role,
            isActive: true,
            isDeleted: false,
        }).select("permissions");
        const permissions = role?.permissions ?? [];
        // 5. Build JWT payload
        const jwtPayload = {
            tenantId: user.tenantId.toString(),
            userId: user._id.toString(),
            role: user.role,
            branchIds: user.branchIds.map((b) => b.toString()),
            permissions,
        };
        // 6. Sign tokens
        const accessToken = signAccessToken(jwtPayload);
        const refreshToken = signRefreshToken(user._id.toString(), user.tenantId.toString());
        // 7. Update last login
        await this.userRepo.updateLastLogin(user._id.toString());
        // 8. Return response
        return {
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isSuperAdmin: user.isSuperAdmin,
                branchIds: user.branchIds,
                tenantId: user.tenantId,
            },
        };
    }
    //Refresh token
    async refreshToken(input) {
        try {
            // 1. Verify refresh token
            const decoded = jsonwebtoken_1.default.verify(input.refreshToken, process.env.JWT_REFRESH_SECRET);
            // 2. Find user
            const user = await user_model_1.UserModel.findOne({
                _id: new mongoose_1.default.Types.ObjectId(decoded.userId),
                tenantId: new mongoose_1.default.Types.ObjectId(decoded.tenantId),
                isActive: true,
                isDeleted: false,
            });
            if (!user) {
                throw new app_error_1.AppError("User not found or deactivated", 401);
            }
            // 3. Load permissions dynamically
            const role = await role_model_1.RoleModel.findOne({
                tenantId: new mongoose_1.default.Types.ObjectId(user.tenantId.toString()),
                slug: user.role,
                isActive: true,
                isDeleted: false,
            }).select("permissions");
            const permissions = role?.permissions ?? [];
            // 4. Build JWT payload
            const jwtPayload = {
                tenantId: user.tenantId.toString(),
                userId: user._id.toString(),
                role: user.role,
                branchIds: user.branchIds.map((b) => b.toString()),
                permissions,
            };
            // 5. Issue new tokens
            const newAccessToken = signAccessToken(jwtPayload);
            const newRefreshToken = signRefreshToken(user._id.toString(), user.tenantId.toString());
            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            throw new app_error_1.AppError("Invalid or expired refresh token", 401);
        }
    }
    //Get me
    async getMe(userId) {
        const user = await user_model_1.UserModel
            .findOne({
            _id: new mongoose_1.default.Types.ObjectId(userId),
            isDeleted: false,
        })
            .select("-passwordHash");
        if (!user) {
            throw new app_error_1.AppError("User not found", 404);
        }
        return user.toSafeObject();
    }
    async forgotPassword(input) {
        const user = await user_model_1.UserModel.findOne({
            email: input.email.toLowerCase(),
            isDeleted: false,
        });
        if (!user) {
            return { message: "If an account with that email exists, a reset link has been sent." };
        }
        const rawToken = crypto_1.default.randomBytes(32).toString("hex");
        const hashedToken = crypto_1.default.createHash("sha256").update(rawToken).digest("hex");
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        const resetUrl = `${env_1.env.frontendUrl}/reset-password?token=${rawToken}`;
        await email_service_1.emailService.sendEmail(user.email, `${user.firstName} ${user.lastName}`, "Reset your HRMs password", `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>Click the button below to reset your password. This link expires in 15 minutes.</p>
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 24px; background: #2886CE; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
          <p style="margin-top: 24px; color: #666; font-size: 12px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `);
        return { message: "If an account with that email exists, a reset link has been sent." };
    }
    async resetPassword(input) {
        const hashedToken = crypto_1.default.createHash("sha256").update(input.token).digest("hex");
        const user = await user_model_1.UserModel.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() },
            isDeleted: false,
        });
        if (!user) {
            throw new app_error_1.AppError("Invalid or expired reset token", 400);
        }
        const passwordHash = await bcrypt_1.default.hash(input.password, BCRYPT_SALT_ROUNDS);
        user.passwordHash = passwordHash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        return { message: "Password reset successful. You can now login with your new password." };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map