import mongoose, { Document } from "mongoose";
import { createPlatformSchema } from "../../core/database/base.schema";

// PERMISSION DOCUMENT INTERFACE
// Platform level — no tenantId, no branchId
// These are fixed — defined by your team, not by clients

export interface PermissionDocument extends Document {
  module:      string;   // "employee", "payroll", "leave"
  action:      string;   // "read", "create", "update", "delete", "approve", "run"
  resource:    string;   // "employee.read" — full permission key
  description: string;   // human readable
  isActive:    boolean;
  version:     number;
  createdAt:   Date;
  updatedAt:   Date;
}

const PermissionSchema = createPlatformSchema<PermissionDocument>({
  module: {
    type:      String,
    required:  true,
    trim:      true,
    lowercase: true,
    // e.g. "employee", "attendance", "leave", "payroll"
  },
  action: {
    type:      String,
    required:  true,
    trim:      true,
    lowercase: true,
    // e.g. "read", "create", "update", "delete", "approve", "run"
  },
  resource: {
    // Full permission key — "module.action"
    // e.g. "employee.read", "payroll.run", "leave.approve"
    type:      String,
    required:  true,
    unique:    true,
    trim:      true,
    lowercase: true,
  },
  description: {
    type:     String,
    required: true,
    trim:     true,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
});

PermissionSchema.index({ module: 1 });
PermissionSchema.index({ resource: 1 }, { unique: true });

export const PermissionModel = mongoose.model<PermissionDocument>(
  "Permission",
  PermissionSchema
);