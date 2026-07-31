import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

export interface ActionLogDocument extends OrgLevelDocument {
  userId : mongoose.Types.ObjectId;
  userEmail : string;       // denormalized for fast display without a join
  module : string;       // "employee", "leave", "payroll" etc.
  action : string;       // "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT"
  resourceType : string;       // "Employee", "LeaveRequest"
  resourceId? : mongoose.Types.ObjectId;
  oldValue? : Record<string, unknown>;
  newValue? : Record<string, unknown>;
  ipAddress? : string;
  requestId? : string;       // ties to Winston's request-id for cross-reference
  success : boolean;
  errorMessage? : string;
}

const ActionLogSchema = createOrgLevelSchema<ActionLogDocument>(
  {
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        index: true 
    },
    userEmail: { 
        type: String, 
        required: true, 
        lowercase: true 
    },
    module: { 
        type: String, 
        required: true, 
        trim: true 
    },
    action: { 
        type: String, 
        required: true, 
        trim: true 
    },
    resourceType: { 
        type: String, 
        required: true, 
        trim: true 
    },
    resourceId: { 
        type: mongoose.Schema.Types.ObjectId 
    },
    oldValue: { 
        type: mongoose.Schema.Types.Mixed 
    },
    newValue: { 
        type: mongoose.Schema.Types.Mixed 
    },
    ipAddress: { 
        type: String, 
        trim: true 
    },
    requestId: { 
        type: String, 
        trim: true 
    },
    success: { 
        type: Boolean, 
        default: true 
    },
    errorMessage: { 
        type: String, 
        trim: true 
    },
  },
  { collection: "action_logs" }
);

ActionLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
ActionLogSchema.index({ tenantId: 1, module: 1, action: 1, createdAt: -1 });
ActionLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });

export const ActionLogModel = mongoose.model<ActionLogDocument>("ActionLog", ActionLogSchema);