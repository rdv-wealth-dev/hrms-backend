import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import mongoose from "mongoose";

import { UserRepository } from "../user/user.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { BranchRepository } from "../branch/branch.repository";
import { UserModel } from "../user/user.model";
import { seedDefaultRoles } from "../role/role.seed";

import crypto from "crypto";
import { emailService } from "../../service/email.service";
import { env } from "../../config/env";
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput, VerifyEmailInput, ActivateAccountInput } from "./auth.dto";
import { AppError, InvalidCredentialsError, AccountInactiveError, RefreshInvalidError, } from "../../core/errors/app.error";
import { JwtPayload } from "../../core/interfaces/jwt-payload.interface";

// CONSTANTS

const BCRYPT_SALT_ROUNDS   = 12;
const ACCESS_TOKEN_EXPIRY  = "1d";
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
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: "USD", CA: "CAD", GB: "GBP", EU: "EUR",
  IN: "INR", AE: "AED", SA: "SAR", QA: "QAR",
  AU: "AUD", SG: "SGD", MY: "MYR", TH: "THB",
  JP: "JPY", CN: "CNY", KR: "KRW", HK: "HKD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  NL: "EUR", BE: "EUR", PT: "EUR", GR: "EUR",
  IE: "EUR", AT: "EUR", FI: "EUR", SE: "SEK",
  NO: "NOK", DK: "DKK", CH: "CHF", NZ: "NZD",
  ZA: "ZAR", BR: "BRL", MX: "MXN", RU: "RUB",
};

function getCurrencyFromCountry(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode] || "USD";
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
        countryCode:        input.countryCode,
        timezone:           input.timezone,
        currencyCode:       getCurrencyFromCountry(input.countryCode),
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
        maxBranches:  2,
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

    const tenantId  = organization._id.toString();
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
        countryCode: input.countryCode,
      },
      workPolicy: {
        timezone:           input.timezone,
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
    // (Returns a map of slug -> roleId — no longer used for JWT, kept for
    // possible future use such as assigning roleId references elsewhere)
    await seedDefaultRoles(tenantId, "system");

    // 7. Create super admin user
    const superAdmin = await new UserModel({
      tenantId:        tenantObjectId,
      email:           input.email.toLowerCase(),
      passwordHash,
      firstName:       input.firstName,
      lastName:        input.lastName,
      phone:           input.phone,
      role:            "ORG_ADMIN",
      isOrgAdmin:    true,
      isActive:        true,
      isEmailVerified: false,
      branchIds:       [headOffice._id],
      // permissions:     [],
    }).save();

    // 8. Generate email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto.createHash("sha256").update(rawVerificationToken).digest("hex");

    superAdmin.emailVerificationToken = hashedVerificationToken;
    superAdmin.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await superAdmin.save();

    // 9. Send verification email
    const verificationUrl = `${env.frontendUrl}/verify-email?token=${rawVerificationToken}`;

    await emailService.sendEmail(
      superAdmin.email,
      `${superAdmin.firstName} ${superAdmin.lastName}`,
      "Verify your HRMs email address",
      `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Welcome to HRMs!</h2>
          <p>Click the button below to verify your email address and activate your account. This link expires in 24 hours.</p>
          <a href="${verificationUrl}"
             style="display: inline-block; padding: 12px 24px; background: #2886CE; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
          <p style="margin-top: 24px; color: #666; font-size: 12px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `
    );

    // 10. Return response
    return {
      message: "Registration successful! Please check your email to verify your account before logging in.",
      organization: {
        id:           organization._id,
        companyName:  organization.companyName,
        slug:         organization.slug,
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

    // 3. Check email is verified
    if (!user.isEmailVerified) {
      throw new AppError(
        "Please verify your email address before logging in. Check your inbox for the verification link.",
        403
      );
    }

    // 4. Compare password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // 5. Build JWT payload — role slug only, no permissions array.
    // Permission checks are resolved fresh per-request in rbac.middleware.ts
    // by reading the roles collection directly. This keeps the token small
    // and means role/permission edits take effect immediately instead of
    // waiting for the token to expire.
    const jwtPayload = {
      tenantId:  user.tenantId.toString(),
      userId:    user._id.toString(),
      role:      user.role,
      branchIds: user.branchIds.map((b: any) => b.toString()),
    };

    // 6. Sign tokens
    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(
      user._id.toString(),
      user.tenantId.toString()
    );

    // 7. Fetch organization and head office branch
    const org = await this.orgRepo.findById(user.tenantId.toString());
    const headOffice = await this.branchRepo.findHeadOffice(user.tenantId.toString());

    // 8. Update last login
    await this.userRepo.updateLastLogin(user._id.toString());

    // 9. Return response
    return {
      accessToken,
      // refreshToken,
      user: {
        id:           user._id,
        email:        user.email,
        firstName:    user.firstName,
        lastName:     user.lastName,
        role:         user.role,
        isOrgAdmin: user.isOrgAdmin,
        branchIds:    user.branchIds,
        tenantId:     user.tenantId,
        employeeId:   user.employeeId,
      },
      organization: {
        id:           org!._id,
        companyName:  org!.companyName,
        slug:         org!.slug,
        subscription: org!.subscription,
        modules:      org!.modules,
      },
      branch: {
        id:   headOffice!._id,
        name: headOffice!.name,
        code: headOffice!.code,
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

      // 3. Build JWT payload — same minimal shape as login()
      const jwtPayload = {
        tenantId:  user.tenantId.toString(),
        userId:    user._id.toString(),
        role:      user.role,
        branchIds: user.branchIds.map((b: any) => b.toString()),
      };

      // 4. Issue new tokens
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

  // Verify email
  async verifyEmail(input: VerifyEmailInput) {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");

    const user = await UserModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      throw new AppError("Invalid or expired verification token", 400);
    }

    if (user.isEmailVerified) {
      return { message: "Email is already verified. You can log in now." };
    }

    user.isEmailVerified = true;
    // Note: we intentionally do NOT clear emailVerificationToken/Expires here.
    // If this same request fires twice in quick succession — React StrictMode's
    // double-effect in dev, an email client's link-scanning security bot, or a
    // user double-clicking the link — the second call must find this same user
    // again and hit the `user.isEmailVerified` early-return above, returning a
    // friendly "already verified" message instead of a false "invalid or
    // expired token" error. The token still expires naturally via
    // emailVerificationExpires, so this stays safe.
    await user.save();

    return { message: "Email verified successfully! You can now log in to your account." };
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

  // Activate employee account - set password for the first time
  async activateAccount(input: ActivateAccountInput) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(input.token)
      .digest("hex");

    const user = await UserModel.findOne({
      accountActivationToken: hashedToken,
      accountActivationExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(
        "Invalid or expired activation link. Please contact your HR team.",
        400
      );
    }

    if (user.isActive) {
      throw new AppError("This account is already activated. You can log in now.", 400);
    }

    // Hash the new password and activate account
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    user.passwordHash = passwordHash;
    user.isActive = true;
    user.isEmailVerified = true;
    user.accountActivationToken = undefined;
    user.accountActivationExpires = undefined;
    await user.save();

    // Build JWT — same minimal shape as login
    const jwtPayload = {
      tenantId: user.tenantId.toString(),
      userId: user._id.toString(),
      role: user.role,
      branchIds: user.branchIds.map((b: any) => b.toString()),
    };

    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(user._id.toString(), user.tenantId.toString());

    await this.userRepo.updateLastLogin(user._id.toString());

    // Send confirmation email
    await emailService.sendEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      "Your HRMS account is now active",
      `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Account Activated!</h2>
          <p>Hi ${user.firstName}, your HRMS account is now active.</p>
          <p>You can log in at any time using your email and password.</p>
          <a href="${env.frontendUrl}/login"
             style="display:inline-block; padding:12px 24px; background:#2886CE;
                    color:white; text-decoration:none; border-radius:4px;">
            Login to HRMS
          </a>
        </div>
      `
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isOrgAdmin: user.isOrgAdmin,
        branchIds: user.branchIds,
        tenantId: user.tenantId,
        employeeId: user.employeeId,
      },
      message: "Account activated successfully!",
    };
  }
}