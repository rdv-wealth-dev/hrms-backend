import mongoose, { Document } from "mongoose";
import { createPlatformSchema } from "../../core/database/base.schema";

export interface PermissionDocument extends Document {
  module:      string;
  action:      string;
  resource:    string;
  description: string;
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
  },
  action: {
    type:      String,
    required:  true,
    trim:      true,
    lowercase: true,
  },
  resource: {
    type:      String,
    required:  true,
    trim:      true,
    lowercase: true,
    // NO unique:true here — defined below
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

// Single indexes — no duplicates
PermissionSchema.index({ module: 1 });
PermissionSchema.index({ resource: 1 }, { unique: true });

export const PermissionModel = mongoose.model<PermissionDocument>(
  "Permission",
  PermissionSchema
);