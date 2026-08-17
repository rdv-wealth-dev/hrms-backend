import mongoose, {Schema, Document, Model} from "mongoose";

export enum CSuiteRole {
  CEO = "CEO",
  COO = "COO",
  CFO = "CFO",
  CMO = "CMO",
  CIO = "CIO",
  CTO = "CTO",
  CHRO = "CHRO",
  CPO = "CPO",
  NONE = "NONE",
}

export enum WorkRelationshipType {
  PEER_REVIEW = "PEER_REVIEW",
  TASK_SUBMISSION = "TASK_SUBMISSION",
  MATRIX_PROJECT = "MATRIX_PROJECT",
  CODE_REVIEW = "CODE_REVIEW",
  BUDGET_APPROVAL = "BUDGET_APPROVAL",
  FUNCTIONAL_APPROVER = "FUNCTIONAL_APPROVER",
}

// 1. ORG NODE INTERFACE & SCHEMA (Position / Seat)

export interface IOrgNode extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  title: string;
  code?: string;
  departmentId?: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId | null;
  cSuiteRole: CSuiteRole;
  levelTier: number; // 1 = C-Suite, 2 = Wing/Division, 3 = Dept, 4 = Manager, 5 = Lead, 6 = IC, 7 = Sub
  levelName: string; // e.g. "Executive", "Department", "Squad", etc.
  isVacant: boolean;
  actingNodeId?: mongoose.Types.ObjectId | null; // Node that covers this position temporarily
  description?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgNodeSchema = new Schema<IOrgNode>(
  {
    tenantId: { 
        type: Schema.Types.ObjectId, 
        required: true, 
        index: true 
    },
    branchId: { 
        type: Schema.Types.ObjectId, 
        index: true 
    },
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    code: { 
        type: String, 
        trim: true 
    },
    departmentId: { 
        type: Schema.Types.ObjectId, 
        ref: "Department", 
        index: true 
    },
    parentId: { 
        type: Schema.Types.ObjectId, 
        ref: "OrgNode", 
        default: null, 
        index: true 
    },
    cSuiteRole: {
      type: String,
      enum: Object.values(CSuiteRole),
      default: CSuiteRole.NONE,
      index: true,
    },
    levelTier: { 
        type: Number, 
        required: true, 
        index: true 
    },
    levelName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    isVacant: { 
        type: Boolean, 
        default: true, 
        index: true 
    },
    actingNodeId: { 
        type: Schema.Types.ObjectId, 
        ref: "OrgNode", 
        default: null 
    },
    description: { 
        type: String, 
        trim: true 
    },
    metadata: { 
        type: Schema.Types.Mixed, 
        default: {} 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isDeleted: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
  },
  { timestamps: true }
);

OrgNodeSchema.index({ tenantId: 1, parentId: 1 });
OrgNodeSchema.index({ tenantId: 1, cSuiteRole: 1 });



// 2. ORG NODE ASSIGNMENT (Person to Node mapping)

export interface IOrgNodeAssignment extends Document {
  tenantId: mongoose.Types.ObjectId;
  nodeId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  isPrimary: boolean;
  isActing: boolean;
  startDate: Date;
  endDate?: Date | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgNodeAssignmentSchema = new Schema<IOrgNodeAssignment>(
  {
    tenantId: { 
        type: Schema.Types.ObjectId, 
        required: true, 
        index: true 
    },
    nodeId: { 
        type: Schema.Types.ObjectId, 
        ref: "OrgNode", 
        required: true, 
        index: true 
    },
    employeeId: { 
        type: Schema.Types.ObjectId, 
        ref: "Employee", 
        required: true, 
        index: true 
    },
    isPrimary: { 
        type: Boolean, 
        default: true 
    },
    isActing: { 
        type: Boolean, 
        default: false 
    },
    startDate: { 
        type: Date, 
        required: true, 
        default: Date.now 
    },
    endDate: { 
        type: Date, 
        default: null 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isDeleted: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
  },
  { timestamps: true }
);

OrgNodeAssignmentSchema.index({ tenantId: 1, employeeId: 1, isActive: 1 });
OrgNodeAssignmentSchema.index({ tenantId: 1, nodeId: 1, isActive: 1 });


// 3. WORK SUBMISSION & MATRIX ROUTES (Functional Line)

export interface IWorkSubmissionRoute extends Document {
  tenantId: mongoose.Types.ObjectId;
  fromNodeId: mongoose.Types.ObjectId;
  toNodeId: mongoose.Types.ObjectId;
  relationshipType: WorkRelationshipType;
  projectName?: string;
  startDate: Date;
  endDate?: Date | null;
  notes?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}


const WorkSubmissionRouteSchema = new Schema<IWorkSubmissionRoute>(
  {
    tenantId: { 
        type: Schema.Types.ObjectId, 
        required: true, 
        index: true 
    },
    fromNodeId: { 
        type: Schema.Types.ObjectId, 
        ref: "OrgNode", 
        required: true, 
        index: true 
    },
    toNodeId: { 
        type: Schema.Types.ObjectId, 
        ref: "OrgNode", 
        required: true, 
        index: true 
    },
    relationshipType: {
      type: String,
      enum: Object.values(WorkRelationshipType),
      required: true,
      index: true,
    },
    projectName: { 
        type: String, 
        trim: true 
    },
    startDate: { 
        type: Date, 
        required: true, 
        default: Date.now 
    },
    endDate: { 
        type: Date, 
        default: null 
    },
    notes: { 
        type: String, 
        trim: true 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isDeleted: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
  },
  { timestamps: true }
);
WorkSubmissionRouteSchema.index({ tenantId: 1, fromNodeId: 1, isActive: 1 });
WorkSubmissionRouteSchema.index({ tenantId: 1, toNodeId: 1, isActive: 1 });

// MODEL EXPORTS

export const OrgNodeModel: Model<IOrgNode> = mongoose.model<IOrgNode>("OrgNode", OrgNodeSchema);
export const OrgNodeAssignmentModel: Model<IOrgNodeAssignment> = mongoose.model<IOrgNodeAssignment>("OrgNodeAssignment", OrgNodeAssignmentSchema);
export const WorkSubmissionRouteModel: Model<IWorkSubmissionRoute> = mongoose.model<IWorkSubmissionRoute>("WorkSubmissionRoute", WorkSubmissionRouteSchema);
