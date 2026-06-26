import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";

import { UserRepository } from "../user/user.repository";
import { OrganizationRepository } from "../organizations/organization.repository";
import { BranchRepository } from "../branch/branch.repository";

import { RegisterInput, LoginInput, RefreshTokenInput } from "./auth.dto";
import { AppError } from "../../core/errors/app.error";
import { JwtPayload } from "../../core/interfaces/jwt-payload.interface";

// CONSTANTS

const BCRYPT_SALT_ROUNDS  = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY= "7d";

// HELPERS

// Generate URL-safe slug from company name
// "ABC Technologies Pvt Ltd" → "abc-technologies-pvt-ltd"
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Sign access token
function signAccessToken(payload: Omit<JwtPayload, "jti" | "iat" | "exp">): string {
  const jti = uuid();
  return jwt.sign(
    { ...payload, jti },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// Sign refresh token
function signRefreshToken(userId: string, tenantId: string): string {
  return jwt.sign(
    { userId, tenantId, jti: uuid() },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

// AUTH SERVICE

export class AuthService {
  private userRepo  = new UserRepository();
  private orgRepo   = new OrganizationRepository();
  private branchRepo= new BranchRepository();

  // Register
  async register(input: RegisterInput) {
    // 1. Generate slug and check uniqueness
    let slug = generateSlug(input.companyName);
    const slugTaken = await this.orgRepo.slugExists(slug);
    if (slugTaken) {
      slug = `${slug}-${Date.now()}`;  // append timestamp if taken
    }

    // 2. Create organization
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
        trialEndsAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
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

    const tenantId = organization._id.toString();

    // 3. Create Head Office branch automatically
    const headOffice = await this.branchRepo.create({
      tenantId:     organization._id as any,
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

    const branchId = headOffice._id.toString();

    // 4. Hash password
    const passwordHash = await bcrypt.hash(
      input.password,
      BCRYPT_SALT_ROUNDS
    );

    // 5. Super admin permissions — full access
    const superAdminPermissions = [
      "employee.read",    "employee.create",   "employee.update",  "employee.delete",
      "attendance.read",  "attendance.create",  "attendance.update",
      "leave.read",       "leave.create",       "leave.update",     "leave.approve",
      "payroll.read",     "payroll.create",     "payroll.run",      "payroll.approve",
      "branch.read",      "branch.create",      "branch.update",
      "department.read",  "department.create",  "department.update",
      "role.read",        "role.create",        "role.update",
      "report.read",      "settings.read",      "settings.update",
    ];

    // 6. Create super admin user
    const user = await this.userRepo["model"] === undefined
      ? await (() => {
          const { UserModel } = require("../user/user.model");
          return new UserModel({
            tenantId:        organization._id,
            email:           input.email,
            passwordHash,
            firstName:       input.firstName,
            lastName:        input.lastName,
            phone:           input.phone,
            role:            "SUPER_ADMIN",
            isSuperAdmin:    true,
            isActive:        true,
            isEmailVerified: false,
            branchIds:       [],          // empty = access to all branches
            permissions:     superAdminPermissions,
          }).save();
        })()
      : null;

    // Cleaner approach — direct model import
    const { UserModel } = require("../user/user.model");
    const superAdmin = await new UserModel({
      tenantId:        organization._id,
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
      permissions:     superAdminPermissions,
    }).save();

    // 7. Generate tokens
    const jwtPayload = {
      tenantId:    tenantId,
      userId:      superAdmin._id.toString(),
      role:        "SUPER_ADMIN",
      branchIds:   [],    // empty = all branches
      permissions: superAdminPermissions,
    };

    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(superAdmin._id.toString(), tenantId);

    // 8. Update last login
    await this.userRepo.updateLastLogin(superAdmin._id.toString());

    return {
      accessToken,
      refreshToken,
      user: {
        id:          superAdmin._id,
        email:       superAdmin.email,
        firstName:   superAdmin.firstName,
        lastName:    superAdmin.lastName,
        role:        superAdmin.role,
        isSuperAdmin:superAdmin.isSuperAdmin,
        branchIds:   superAdmin.branchIds,
        permissions: superAdmin.permissions,
      },
      organization: {
        id:          organization._id,
        companyName: organization.companyName,
        slug:        organization.slug,
        subscription:organization.subscription,
        modules:     organization.modules,
      },
      branch: {
        id:   headOffice._id,
        name: headOffice.name,
        code: headOffice.code,
      },
    };
  }

  //Login
  async login(input: LoginInput) {
    // 1. Find user by email — includes passwordHash
    const user = await this.userRepo.findByEmail(input.email);

    if (!user) {
      // Generic message — do not reveal if email exists or not
      throw new AppError("Invalid email or password", 401);
    }

    // 2. Check account is active
    if (!user.isActive) {
      throw new AppError("Account is deactivated. Contact your administrator.", 401);
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // 4. Build JWT payload
    const jwtPayload = {
      tenantId:    user.tenantId.toString(),
      userId:      user._id.toString(),
      role:        user.role,
      branchIds:   user.branchIds.map((b) => b.toString()),
      permissions: user.permissions,
    };

    // 5. Sign tokens
    const accessToken  = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(
      user._id.toString(),
      user.tenantId.toString()
    );

    // 6. Update last login
    await this.userRepo.updateLastLogin(user._id.toString());

    return {
      accessToken,
      refreshToken,
      user: {
        id:          user._id,
        email:       user.email,
        firstName:   user.firstName,
        lastName:    user.lastName,
        role:        user.role,
        isSuperAdmin:user.isSuperAdmin,
        branchIds:   user.branchIds,
        permissions: user.permissions,
        tenantId:    user.tenantId,
      },
    };
  }

  // Refresh token
  async refreshToken(input: RefreshTokenInput) {
    try {
      // 1. Verify refresh token
      const decoded = jwt.verify(
        input.refreshToken,
        process.env.JWT_REFRESH_SECRET as string
      ) as { userId: string; tenantId: string };

      // 2. Find user
      const { UserModel } = require("../user/user.model");
      const user = await UserModel.findOne({
        _id:       decoded.userId,
        tenantId:  decoded.tenantId,
        isActive:  true,
        isDeleted: false,
      });

      if (!user) {
        throw new AppError("User not found", 401);
      }

      // 3. Issue new access token
      const jwtPayload = {
        tenantId:    user.tenantId.toString(),
        userId:      user._id.toString(),
        role:        user.role,
        branchIds:   user.branchIds.map((b: any) => b.toString()),
        permissions: user.permissions,
      };

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
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  //Get me
  async getMe(userId: string) {
    const { UserModel } = require("../user/user.model");
    const user = await UserModel.findOne({
      _id:       userId,
      isDeleted: false,
    }).select("-passwordHash");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user.toSafeObject();
  }
}