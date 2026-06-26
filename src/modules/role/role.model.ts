import mongoose, { Document } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

// ROLE DOCUMENT INTERFACE
// Org level — each tenant defines their own roles
// System roles (SUPER_ADMIN etc.) created automatically on registration

export interface RoleDocument extends OrgLevelDocument {
  name:         string;
  slug:         string;   // "SUPER_ADMIN", "HR_ADMIN" — used in JWT
  description:  string;
  permissions:  string[]; // ["employee.read", "payroll.run", ...]
  isSystemRole: boolean;  // true = cannot be deleted by tenant
  isActive:     boolean;
}

const RoleSchema = createOrgLevelSchema<RoleDocument>({
  name: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 100,
  },
  slug: {
    // Machine-readable identifier — stored in JWT
    // e.g. "SUPER_ADMIN", "HR_ADMIN", "MANAGER"
    type:      String,
    required:  true,
    trim:      true,
    uppercase: true,
  },
  description: {
    type:      String,
    trim:      true,
    maxlength: 500,
    default:   "",
  },
  permissions: {
    // Array of permission resource keys
    // e.g. ["employee.read", "leave.approve", "payroll.run"]
    type:    [String],
    default: [],
  },
  isSystemRole: {
    // System roles cannot be deleted or renamed by tenant
    // Created automatically on organization registration
    type:    Boolean,
    default: false,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
});

// slug unique per tenant
RoleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
RoleSchema.index({ tenantId: 1, isActive: 1 });
RoleSchema.index({ tenantId: 1, isSystemRole: 1 });

export const RoleModel = mongoose.model<RoleDocument>(
  "Role",
  RoleSchema
);