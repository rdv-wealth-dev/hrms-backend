import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import mongoose from "mongoose";

import { UserRepository } from "../user/user.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { BranchRepository } from "../branch/branch.repository";
import { UserModel } from "../user/user.model";
import { seedDefaultRoles } from "../role/role.seed";
import { seedDepartments } from "../department/department.seed";
import { seedDesignations } from "../designation/designation.seed";
import { seedLeaveTypes } from "../leave/leave-types/leave-type.seed";
import { seedShifts } from "../attendance/shifts/shift.seed";

import crypto from "crypto";
import { emailService } from "../../service/email.service";
import { env } from "../../config/env";
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput, VerifyEmailInput, ActivateAccountInput, ResendVerificationEmailInput, OnboardingWizardInput } from "./auth.dto";
import { AppError, InvalidCredentialsError, AccountInactiveError, RefreshInvalidError, } from "../../core/errors/app.error";
import { JwtPayload } from "../../core/interfaces/jwt-payload.interface";

// CONSTANTS

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "1d";
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
  userId: string,
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

// Default fiscal year start by country
function getFiscalYearFromCountry(countryCode: string): string {
  const FISCAL_MAP: Record<string, string> = {
    IN: "April",  // India: April–March
    GB: "April",  // UK: April–March
    AU: "July",   // Australia: July–June
    NZ: "April",  // NZ: April–March
    JP: "April",  // Japan: April–March
  };
  return FISCAL_MAP[countryCode] || "January"; // default: Jan–Dec
}

function capitalize(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// AUTH SERVICE

export class AuthService {
  private userRepo = new UserRepository();
  private orgRepo = new OrganizationRepository();
  private branchRepo = new BranchRepository();

  //Register
  async register(input: RegisterInput) {

    // 1. Check if email already exists globally
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    // 2. Validate & check workspace slug
    const workspaceSlug = input.workspaceSlug; // already validated by DTO
    const slugTaken = await this.orgRepo.workspaceSlugExists(workspaceSlug);
    if (slugTaken) {
      const suggestions = await this.orgRepo.suggestSlugs(workspaceSlug);
      throw new AppError(
        `Workspace URL "${workspaceSlug}" is already taken.`,
        409,
        undefined,   // use default errorCode
        suggestions  // frontend reads these as clickable suggestion chips
      );
    }

    // 2b. Generate internal slug (still needed for legacy routing)
    let slug = generateSlug(input.companyName);
    const internalSlugTaken = await this.orgRepo.slugExists(slug);
    if (internalSlugTaken) {
      slug = `${slug}-${Date.now()}`;
    }

    const defaultCountry = "IN";
    const defaultTimezone = "Asia/Kolkata";

    // 3. Create organization (using default locale/ranges until Step 2 onboarding wizard)
    const organization = await this.orgRepo.create({
      companyName:         input.companyName,
      slug,
      workspaceSlug:       input.workspaceSlug,
      employeeCountRange:  "1-10",
      onboardingCompleted: false,
      onboardingStatus:    "step1_completed",
      industry:            "Technology",
      locale: {
        countryCode:        defaultCountry,
        timezone:           defaultTimezone,
        currencyCode:       getCurrencyFromCountry(defaultCountry),
        dateFormat:         "DD/MM/YYYY",
        timeFormat:         "12h",
        fiscalYearStart:    getFiscalYearFromCountry(defaultCountry),
        weeklyOffDays:      ["Sunday"],
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

    const tenantId = organization._id.toString();
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // 4. Hash password
    const passwordHash = await bcrypt.hash(
      input.password,
      BCRYPT_SALT_ROUNDS
    );

    // 5. Create super admin user
    const superAdmin = await new UserModel({
      tenantId: tenantObjectId,
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: capitalize(input.firstName),
      lastName: capitalize(input.lastName),
      role: "ORG_ADMIN",
      isOrgAdmin: true,
      isActive: true,
      isEmailVerified: false,
      branchIds: [],
    }).save();

    // 8. Generate email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto.createHash("sha256").update(rawVerificationToken).digest("hex");

    superAdmin.emailVerificationToken = hashedVerificationToken;
    superAdmin.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    superAdmin.emailVerificationSentAt = new Date();
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
        id:                  organization._id,
        companyName:         organization.companyName,
        slug:                organization.slug,
        workspaceSlug:       organization.workspaceSlug,
        workspaceUrl:        `https://${organization.workspaceSlug}.yourhrms.com`,
        onboardingCompleted: organization.onboardingCompleted,
        onboardingStatus:    organization.onboardingStatus,
      },
    };
  }

  // Login
  async login(
    input: LoginInput,
    meta?: { ip?: string; device?: string; rememberDevice?: boolean }
  ) {

    // 1. Find user by email — never reveal whether the email exists
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

    // 4. Check DB-level lockout (complements Redis rate limiter on route layer)
    const lockout = await this.userRepo.isLockedOut(user._id.toString());
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingSecs / 60);
      throw new AppError(
        `Too many failed login attempts. Account locked for ${mins} minute(s). Try again later or reset your password.`,
        429,
        undefined,
        [{ remainingSecs: lockout.remainingSecs, lockoutActive: true }]
      );
    }

    // 5. Compare password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      // Increment attempt counter — may trigger a 15-min lockout at 5 failures
      const attempts  = await this.userRepo.incrementLoginAttempts(user._id.toString());
      const MAX       = 5;
      const remaining = Math.max(MAX - attempts, 0);

      if (remaining === 0) {
        throw new AppError(
          "Too many failed attempts. Account locked for 15 minutes.",
          429,
          undefined,
          [{ lockoutActive: true, remainingSecs: 900 }]
        );
      }

      throw new AppError(
        `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`,
        401,
        undefined,
        [{ attemptsRemaining: remaining }]
      );
    }

    // 6. Check if password reset is required (HR-invited employees)
    //    Frontend redirects to /change-password when this is true
    const requiresPasswordReset = user.requiresPasswordReset ?? false;

    // 7. Build JWT payload — role slug only, no permissions array.
    //    Permissions are resolved fresh per-request in rbac.middleware.ts,
    //    so role changes take effect immediately without token re-issuance.
    const jwtPayload = {
      tenantId:  user.tenantId.toString(),
      userId:    user._id.toString(),
      role:      user.role,
      branchIds: user.branchIds.map((b: any) => b.toString()),
    };

    // 8. Sign tokens
    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(
      user._id.toString(),
      user.tenantId.toString()
    );

    // 9. Handle remember device — stores a 30-day hashed token
    let rememberDeviceToken: string | undefined;
    if (meta?.rememberDevice) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hash     = crypto.createHash("sha256").update(rawToken).digest("hex");
      await this.userRepo.addRememberDeviceToken(
        user._id.toString(),
        hash,
        meta.device ?? "unknown"
      );
      rememberDeviceToken = rawToken; // send to frontend as httpOnly cookie
    }

    // 10. Fetch org and head office (parallel)
    const [org, headOffice] = await Promise.all([
      this.orgRepo.findById(user.tenantId.toString()),
      this.branchRepo.findHeadOffice(user.tenantId.toString()),
    ]);

    // 11. Update last login with IP + device info (resets attempt counter)
    await this.userRepo.updateLastLogin(
      user._id.toString(),
      meta?.ip,
      meta?.device
    );

    // 12. Return response
    return {
      accessToken,
      refreshToken,
      requiresPasswordReset,
      // onboardingCompleted — frontend checks to redirect to wizard after first login
      onboardingCompleted: org?.onboardingCompleted ?? true,
      onboardingStatus:    org?.onboardingStatus ?? "completed",
      rememberDeviceToken, // undefined unless requested; set as httpOnly cookie on client
      user: {
        id:               user._id,
        email:            user.email,
        firstName:        user.firstName,
        lastName:         user.lastName,
        role:             user.role,
        isOrgAdmin:       user.isOrgAdmin,
        branchIds:        user.branchIds,
        tenantId:         user.tenantId,
        employeeId:       user.employeeId,
        lastLoginAt:      user.lastLoginAt,    // previous session — show on dashboard
        lastLoginIp:      user.lastLoginIp,    // previous session IP
        lastLoginDevice:  user.lastLoginDevice,
      },
      organization: {
        id:            org!._id,
        companyName:   org!.companyName,
        slug:          org!.slug,
        workspaceSlug: org!.workspaceSlug,
        subscription:  org!.subscription,
        modules:       org!.modules,
        branding:      org!.branding,          // logo + primaryColor for workspace theming
      },
      branch: headOffice ? {
        id:   headOffice._id,
        name: headOffice.name,
        code: headOffice.code,
      } : null,
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
        _id: new mongoose.Types.ObjectId(decoded.userId),
        tenantId: new mongoose.Types.ObjectId(decoded.tenantId),
        isActive: true,
        isDeleted: false,
      });

      if (!user) {
        throw new AppError("User not found or deactivated", 401);
      }

      // 3. Build JWT payload — same minimal shape as login()
      const jwtPayload = {
        tenantId: user.tenantId.toString(),
        userId: user._id.toString(),
        role: user.role,
        branchIds: user.branchIds.map((b: any) => b.toString()),
      };

      // 4. Issue new tokens
      const newAccessToken = signAccessToken(jwtPayload);
      const newRefreshToken = signRefreshToken(
        user._id.toString(),
        user.tenantId.toString()
      );

      return {
        accessToken: newAccessToken,
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
        _id: new mongoose.Types.ObjectId(userId),
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

  // Resend verification email
  async resendVerificationEmail(input: ResendVerificationEmailInput) {
    const user = await UserModel.findOne({
      email: input.email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      // Return success message anyway to prevent email enumeration attacks
      return { message: "If the account exists, a new verification link has been sent." };
    }

    if (user.isEmailVerified) {
      return { message: "Email is already verified. You can log in now." };
    }

    // Rate limit: 2 minutes cooldown
    if (user.emailVerificationSentAt) {
      const diffMs = Date.now() - user.emailVerificationSentAt.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      if (diffMinutes < 2) {
        const waitSeconds = Math.ceil(120 - (diffMs / 1000));
        throw new AppError(
          `Please wait ${waitSeconds} seconds before requesting another verification email.`,
          429
        );
      }
    }

    // Generate NEW, different verification token and link
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto.createHash("sha256").update(rawVerificationToken).digest("hex");

    user.emailVerificationToken = hashedVerificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    user.emailVerificationSentAt = new Date();
    await user.save();

    const verificationUrl = `${env.frontendUrl}/verify-email?token=${rawVerificationToken}`;

    await emailService.sendEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      "Verify your HRMs email address (Resent)",
      `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>You requested a new verification link. Click the button below to verify your email address. This link expires in 24 hours.</p>
          <a href="${verificationUrl}"
             style="display: inline-block; padding: 12px 24px; background: #2886CE; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
          <p style="margin-top: 24px; color: #666; font-size: 12px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `
    );

    return { message: "A new verification link has been sent to your email address." };
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

  // Complete onboarding wizard (Step 2 — called after email verification)
  async completeOnboarding(tenantId: string, userId: string, input: OnboardingWizardInput) {
    const org = await this.orgRepo.findById(tenantId);
    if (!org) throw new AppError("Organization not found", 404);

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Update locale, industry, employee count from wizard
    await this.orgRepo.updateById(tenantId, {
      industry:           input.industry,
      employeeCountRange: input.employeeCountRange,
      locale: {
        ...org.locale,
        countryCode:     input.countryCode,
        timezone:        input.timezone,
        currencyCode:    input.baseCurrency || getCurrencyFromCountry(input.countryCode),
        fiscalYearStart: input.fiscalYearStart,
      },
    });

    // Create Head Office branch using actual country and timezone
    const headOffice = await this.branchRepo.create({
      tenantId: tenantObjectId as any,
      branchId: tenantObjectId as any,
      name: "Head Office",
      code: "HQ",
      isHeadOffice: true,
      isActive: true,
      address: {
        countryCode: input.countryCode,
      },
      workPolicy: {
        timezone: input.timezone,
        weeklyOffDays: ["Sunday"],
        workingHoursPerDay: 8,
      },
    });

    // Seed default roles for this tenant
    await seedDefaultRoles(tenantId, "system");

    // Seed master data for the head office branch
    const headOfficeId = headOffice._id.toString();
    await seedLeaveTypes(tenantId, headOfficeId);
    const deptMap = await seedDepartments(tenantId, headOfficeId);
    await seedDesignations(tenantId, headOfficeId, deptMap);
    await seedShifts(tenantId, headOfficeId);

    // Save phone and associate the created Head Office branch to the admin user
    await UserModel.findByIdAndUpdate(userId, { 
      phone: input.phone,
      $addToSet: { branchIds: headOffice._id }
    });

    // Mark onboarding done
    await this.orgRepo.markOnboardingComplete(tenantId);

    return {
      message:             "Workspace configured successfully.",
      onboardingCompleted: true,
      onboardingStatus:    "completed",
    };
  }

  // Check email — SSO detection + workspace branding
  // GET /api/v1/auth/check-email — called when user finishes typing email on login page.
  // Returns SSO config so frontend can redirect before showing the password field.
  // Never reveals whether the email/account exists (same shape for both cases).
  async checkEmail(email: string) {
    const user = await this.userRepo.findByEmail(email);

    // Unknown email — return empty shell; do NOT reveal account existence
    if (!user) {
      return {
        exists:      false,
        ssoEnabled:  false,
        provider:    null,
        companyName: null,
        logoUrl:     null,
      };
    }

    const org = await this.orgRepo.findById(user.tenantId.toString());

    // SSO config will be expanded in Phase 2 when SAML / OAuth is built.
    // For now ssoEnabled is always false — structure is ready for org.ssoConfig.
    return {
      exists:      true,
      ssoEnabled:  false,          // org?.ssoConfig?.enabled ?? false
      provider:    null,           // org?.ssoConfig?.provider ?? null
      companyName: org?.companyName ?? null,
      logoUrl:     org?.branding?.logoUrl ?? null,
    };
  }
}