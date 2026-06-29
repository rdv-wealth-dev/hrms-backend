import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

export interface RoleDocument extends OrgLevelDocument {
  name:         string;
  slug:         string;
  description:  string;
  permissions:  string[];
  isSystemRole: boolean;
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
    type:      String,
    required:  true,
    trim:      true,
    uppercase: true,
    // NO index:true here — defined below in compound index
  },
  description: {
    type:      String,
    trim:      true,
    maxlength: 500,
    default:   "",
  },
  permissions: {
    type:    [String],
    default: [],
  },
  isSystemRole: {
    type:    Boolean,
    default: false,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
});

// Compound indexes — tenantId always first
RoleSchema.index({ tenantId: 1, slug: 1 },        { unique: true });
RoleSchema.index({ tenantId: 1, isActive: 1 });
RoleSchema.index({ tenantId: 1, isSystemRole: 1 });

export const RoleModel = mongoose.model<RoleDocument>("Role", RoleSchema);