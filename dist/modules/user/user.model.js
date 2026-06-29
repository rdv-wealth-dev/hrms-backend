"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../../core/database/base.schema");
const UserSchema = (0, base_schema_1.createOrgLevelSchema)({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 255,
    },
    passwordHash: {
        type: String,
        required: true,
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
    branchIds: {
        type: [mongoose_1.default.Schema.Types.ObjectId],
        ref: "Branch",
        default: [],
    },
    // Deprecated — loaded from roles collection dynamically on login
    permissions: {
        type: [String],
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
        id: this._id,
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        fullName: `${this.firstName} ${this.lastName}`,
        phone: this.phone,
        avatar: this.avatar,
        role: this.role,
        isSuperAdmin: this.isSuperAdmin,
        isActive: this.isActive,
        isEmailVerified: this.isEmailVerified,
        branchIds: this.branchIds,
        tenantId: this.tenantId,
        lastLoginAt: this.lastLoginAt,
        createdAt: this.createdAt,
    };
};
exports.UserModel = mongoose_1.default.model("User", UserSchema);
//# sourceMappingURL=user.model.js.map