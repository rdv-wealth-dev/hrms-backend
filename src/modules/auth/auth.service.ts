import bcrypt         from "bcrypt";
import jwt            from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import mongoose       from "mongoose";

import { UserRepository }         from "../user/user.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { BranchRepository }       from "../branch/branch.repository";
import { UserModel }              from "../user/user.model";
import { RoleModel }              from "../role/role.model";
import { seedDefaultRoles }       from "../role/role.seed";

import crypto from "crypto";
import { emailService } from "../../service/email.service";
import { env } from "../../config/env";
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.dto";
import { AppError }   from "../../core/errors/app.error";
import { JwtPayload } from "../../core/interfaces/jwt-payload.interface";

// CONSTANTS

const BCRYPT_SALT_ROUNDS   = 12;
const ACCESS_TOKEN_EXPIRY  = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// HELPERS

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function signAccessToken(
  payload: Omit<JwtPayload, "jti" | "iat" | "exp">
): string {
  const jti = uuid();
  return jwt.sign(
    { ...payload, jti },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function signRefreshToken(
  userId:   string,
  tenantId: string
): string {
  return jwt.sign(
    { userId, tenantId, jti: uuid() },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}
// AUTH SERVICE

export class AuthService {
  private userRepo   = new UserRepository();
  private orgRepo    = new OrganizationRepository();
  private branchRepo = new BranchRepository();

  //Register
  async register(input: RegisterInput) {

    // 1. Check if email already exists globally
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new AppError("Email already registered", 409);
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
      industry:    input.industry,
      locale: {
        countryCode:        input.countryCode ?? "IN",
        timezone:           input.timezone    ?? "Asia/Kolkata",
        currencyCode:       "INR",
        dateFormat:         "DD/MM/YYYY",
        timeFormat:         "12h",
        fiscalYearStart:    "April",
        weeklyOffDays:      ["Saturday", "Sunday"],
        workingHoursPerDay: 8,
      },
      subscription: {
        plan:         "free",
        status:       "trial",
        trialEndsAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        maxEmployees: 10,
        maxBranches:  1,
      },
      modules: {
        attendance:  true,
        leave:       true,
        payroll:     false,
        performance: false,
        recruitment: false,
        assets:      false,
      },
      statutory: {
        pfEnabled:  false,
        esiEnabled: false,
        tdsEnabled: true,
        ptEnabled:  false,
        lwfEnabled: false,
      },
    });

    const tenantId        = organization._id.toString();
    const tenantObjectId  = new mongoose.Types.ObjectId(tenantId);

    // 4. Create Head Office branch
    const headOffice = await this.branchRepo.create({
      tenantId:     tenantObjectId as any,
      branchId:     tenantObjectId as any,
      name:         "Head Office",
      code:         "HQ",
      isHeadOffice: true,
      isActive:     true,
      address: {
        countryCode: input.countryCode ?? "IN",
      },
      workPolicy: {
        timezone:           input.timezone ?? "Asia/Kolkata",
        weeklyOffDays:      ["Saturday", "Sunday"],
        workingHoursPerDay: 8,
      },
    });

    // 5. Hash password
    const passwordHash = await bcrypt.hash(
      input.password,
      BCRYPT_SALT_ROUNDS
    );

    // 6. Seed default roles for this tenant
    const roleMap = await seedDefaultRoles(tenantId, "system");

    // 7. Get SUPER_ADMIN permissions from seeded role
    const superAdminRole = await RoleModel.findOne({
      tenantId:  tenantObjectId,   // ← ObjectId not string
      slug:      "SUPER_ADMIN",
      isDeleted: false,
    }).select("permissions");

    const superAdminPermissions = superAdminRole?.permissions ?? [];

    // 8. Create super admin user
    const superAdmin = await new UserModel({
      tenantId:        tenantObjectId,
      email:           input.email.toLowerCase(),
      passwordHash,
      firstName:       input.firstName,
      lastName:        input.lastName,
      phone:           input.phone,
      role:            "SUPER_ADMIN",
      isSuperAdmin:    true,
      isActive:        true,
      isEmailVerified: false,
      branchIds:       [],
      permissions:     [],
    }).save();

    // 9. Build JWT payload
    const jwtPayload = {
      tenantId:    tenantId,
      userId:      superAdmin._id.toString(),
      role:        "SUPER_ADMIN",
      branchIds:   [] as string[],
      permissions: superAdminPermissions,
    };

    // 10. Sign tokens
    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(
      superAdmin._id.toString(),
      tenantId
    );

    // 11. Update last login
    await this.userRepo.updateLastLogin(superAdmin._id.toString());

    // 12. Return response
    return {
      accessToken,
      refreshToken,
      user: {
        id:           superAdmin._id,
        email:        superAdmin.email,
        firstName:    superAdmin.firstName,
        lastName:     superAdmin.lastName,
        role:         superAdmin.role,
        isSuperAdmin: superAdmin.isSuperAdmin,
        branchIds:    superAdmin.branchIds,
        permissions:  superAdminPermissions,
      },
      organization: {
        id:           organization._id,
        companyName:  organization.companyName,
        slug:         organization.slug,
        subscription: organization.subscription,
        modules:      organization.modules,
      },
      branch: {
        id:   headOffice._id,
        name: headOffice.name,
        code: headOffice.code,
      },
    };
  }

  // Login
  async login(input: LoginInput) {

    // 1. Find user by email
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // 2. Check account is active
    if (!user.isActive) {
      throw new AppError(
        "Account is deactivated. Contact your administrator.",
        401
      );
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // 4. Load permissions dynamically from roles collection
    const role = await RoleModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(user.tenantId.toString()),
      slug:      user.role,
      isActive:  true,
      isDeleted: false,
    }).select("permissions");

    const permissions = role?.permissions ?? [];

    // 5. Build JWT payload
    const jwtPayload = {
      tenantId:    user.tenantId.toString(),
      userId:      user._id.toString(),
      role:        user.role,
      branchIds:   user.branchIds.map((b: any) => b.toString()),
      permissions,
    };

    // 6. Sign tokens
    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(
      user._id.toString(),
      user.tenantId.toString()
    );

    // 7. Update last login
    await this.userRepo.updateLastLogin(user._id.toString());

    // 8. Return response
    return {
      accessToken,
      refreshToken,
      user: {
        id:           user._id,
        email:        user.email,
        firstName:    user.firstName,
        lastName:     user.lastName,
        role:         user.role,
        isSuperAdmin: user.isSuperAdmin,
        branchIds:    user.branchIds,
        permissions,
        tenantId:     user.tenantId,
      },
    };
  }

  //Refresh token
  async refreshToken(input: RefreshTokenInput) {
    try {
      // 1. Verify refresh token
      const decoded = jwt.verify(
        input.refreshToken,
        process.env.JWT_REFRESH_SECRET as string
      ) as { userId: string; tenantId: string };

      // 2. Find user
      const user = await UserModel.findOne({
        _id:       new mongoose.Types.ObjectId(decoded.userId),
        tenantId:  new mongoose.Types.ObjectId(decoded.tenantId),
        isActive:  true,
        isDeleted: false,
      });

      if (!user) {
        throw new AppError("User not found or deactivated", 401);
      }

      // 3. Load permissions dynamically
      const role = await RoleModel.findOne({
        tenantId:  new mongoose.Types.ObjectId(user.tenantId.toString()),
        slug:      user.role,
        isActive:  true,
        isDeleted: false,
      }).select("permissions");

      const permissions = role?.permissions ?? [];

      // 4. Build JWT payload
      const jwtPayload = {
        tenantId:    user.tenantId.toString(),
        userId:      user._id.toString(),
        role:        user.role,
        branchIds:   user.branchIds.map((b: any) => b.toString()),
        permissions,
      };

      // 5. Issue new tokens
      const newAccessToken  = signAccessToken(jwtPayload);
      const newRefreshToken = signRefreshToken(
        user._id.toString(),
        user.tenantId.toString()
      );

      return {
        accessToken:  newAccessToken,
        refreshToken: newRefreshToken,
      };

    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  //Get me
  async getMe(userId: string) {
    const user = await UserModel
      .findOne({
        _id:       new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      })
      .select("-passwordHash");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user.toSafeObject();
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await UserModel.findOne({
      email: input.email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      return { message: "If an account with that email exists, a reset link has been sent." };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const resetUrl = `${env.frontendUrl}/reset-password?token=${rawToken}`;
    await emailService.sendEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      "Reset your HRMs password",
      `
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
      `
    );

    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  async resetPassword(input: ResetPasswordInput) {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");

    const user = await UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return { message: "Password reset successful. You can now login with your new password." };
  }
}