import mongoose, { Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../shared/database/base.schema";

export interface UserDocument extends OrgLevelDocument {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: string;
  isOrgAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  // Login security
  loginAttempts: number;
  lockoutUntil?: Date;
  lastLoginIp?: string;
  lastLoginDevice?: string;
  requiresPasswordReset: boolean;

  // Device trust — "remember this device" tokens
  rememberDeviceTokens: {
    tokenHash: string;
    deviceInfo: string;
    createdAt: Date;
    expiresAt: Date;
  }[];
  branchIds: mongoose.Types.ObjectId[];

  // Deprecated — permissions now loaded dynamically from roles collection
  // Kept for backward compatibility only
  // permissions:     string[];
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  accountActivationToken?: string;
  accountActivationExpires?: Date;
  employeeId?: mongoose.Types.ObjectId;

  toSafeObject(): {
    id: unknown;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone?: string;
    avatar?: string;
    role: string;
    isOrgAdmin: boolean;
    isActive: boolean;
    isEmailVerified: boolean;
    branchIds: string[];
    tenantId: mongoose.Types.ObjectId;
    employeeId: mongoose.Types.ObjectId;
    lastLoginAt?: Date;
    createdAt: Date;

    requiresPasswordReset: boolean;
    lastLoginIp?: string;
    lastLoginDevice?: string;
  };
}

const UserSchema = createOrgLevelSchema<UserDocument>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 255,
  },
  passwordHash: {
    type: String,
    select: false,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
  },
  role: {
    type: String,
    required: true,
    enum: [
      "ORG_ADMIN",
      "HR_ADMIN",
      "BRANCH_ADMIN",
      "LEADERSHIP",
      "MANAGER",
      "PRODUCT_MANAGER",
      "TEAM_LEADER",
      "EMPLOYEE",
    ],
    default: "EMPLOYEE",
  },
  isOrgAdmin: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  lastLoginAt: {
    type: Date,
  },
  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  lockoutUntil: {
    type: Date,
    select: false,
  },
  lastLoginIp: {
    type: String,
    trim: true,
  },
  lastLoginDevice: {
    type: String,
    trim: true,
  },
  requiresPasswordReset: {
    type: Boolean,
    default: false,
  },
  rememberDeviceTokens: {
    type: [{
      tokenHash: { type: String, required: true },
      deviceInfo: { type: String, default: "Unknown" },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
    }],
    default: [],
    select: false,
  },
  branchIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Branch",
    default: [],
  },

  // Deprecated — loaded from roles collection dynamically on login
  // permissions: {
  //   type:    [String],
  //   default: [],
  // },
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    select: false,
  },
  accountActivationToken: {
    type: String,
    select: false,
  },
  accountActivationExpires: {
    type: Date,
    select: false,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  emailVerificationSentAt: {
    type: Date,
    select: false,
  },
});

// Indexes
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, isActive: 1 });
UserSchema.index({ tenantId: 1, isDeleted: 1 });
UserSchema.index({ tenantId: 1, employeeId: 1 });
UserSchema.index({ lockoutUntil: 1 }, { sparse: true });

// Virtual
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Methods
UserSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: `${this.firstName} ${this.lastName}`,
    phone: this.phone,
    avatar: this.avatar,
    role: this.role,
    isOrgAdmin: this.isOrgAdmin,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    requiresPasswordReset: this.requiresPasswordReset,
    branchIds: (this.branchIds || []).map((b: any) => b.toString()),
    tenantId: this.tenantId,
    employeeId: this.employeeId,
    lastLoginAt: this.lastLoginAt,
    lastLoginIp: this.lastLoginIp,
    lastLoginDevice: this.lastLoginDevice,
    createdAt: this.createdAt,
  };
};

export const UserModel = mongoose.model<UserDocument>("User", UserSchema);