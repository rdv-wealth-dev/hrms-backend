import mongoose, { Document } from "mongoose";
import {createOrgLevelSchema,OrgLevelDocument} from "../../core/database/base.schema";

export interface UserDocument extends OrgLevelDocument {
  email:           string;
  passwordHash:    string;
  firstName:       string;
  lastName:        string;
  phone?:          string;
  avatar?:         string;
  role:            string;
  isSuperAdmin:    boolean;
  isActive:        boolean;
  isEmailVerified: boolean;
  lastLoginAt?:    Date;
  branchIds:       mongoose.Types.ObjectId[];

  // Deprecated — permissions now loaded dynamically from roles collection
  // Kept for backward compatibility only
  permissions:     string[];
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;

  toSafeObject(): {
    id:              unknown;
    email:           string;
    firstName:       string;
    lastName:        string;
    fullName:        string;
    phone?:          string;
    avatar?:         string;
    role:            string;
    isSuperAdmin:    boolean;
    isActive:        boolean;
    isEmailVerified: boolean;
    branchIds:       mongoose.Types.ObjectId[];
    tenantId:        mongoose.Types.ObjectId;
    lastLoginAt?:    Date;
    createdAt:       Date;
  };
}

const UserSchema = createOrgLevelSchema<UserDocument>({
  email: {
    type:      String,
    required:  true,
    lowercase: true,
    trim:      true,
    maxlength: 255,
  },
  passwordHash: {
    type:     String,
    required: true,
    select:   false,
  },
  firstName: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 100,
  },
  lastName: {
    type:      String,
    required:  true,
    trim:      true,
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
    type:     String,
    required: true,
    enum: [
      "SUPER_ADMIN",
      "HR_ADMIN",
      "BRANCH_ADMIN",
      "LEADERSHIP",
      "MANAGER",
      "PRODUCT_MANAGER",
      "EMPLOYEE",
    ],
    default: "EMPLOYEE",
  },
  isSuperAdmin: {
    type:    Boolean,
    default: false,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
  isEmailVerified: {
    type:    Boolean,
    default: false,
  },
  lastLoginAt: {
    type: Date,
  },
  branchIds: {
    type:    [mongoose.Schema.Types.ObjectId],
    ref:     "Branch",
    default: [],
  },

  // Deprecated — loaded from roles collection dynamically on login
  permissions: {
    type:    [String],
    default: [],
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
});

// Indexes
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, isActive: 1 });
UserSchema.index({ tenantId: 1, isDeleted: 1 });

// Virtual
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Methods
UserSchema.methods.toSafeObject = function () {
  return {
    id:              this._id,
    email:           this.email,
    firstName:       this.firstName,
    lastName:        this.lastName,
    fullName:        `${this.firstName} ${this.lastName}`,
    phone:           this.phone,
    avatar:          this.avatar,
    role:            this.role,
    isSuperAdmin:    this.isSuperAdmin,
    isActive:        this.isActive,
    isEmailVerified: this.isEmailVerified,
    branchIds:       this.branchIds,
    tenantId:        this.tenantId,
    lastLoginAt:     this.lastLoginAt,
    createdAt:       this.createdAt,
  };
};

export const UserModel = mongoose.model<UserDocument>("User", UserSchema);