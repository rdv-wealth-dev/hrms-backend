import mongoose, { Schema, Document, Model } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../shared/database/base.schema";

export enum TeamType {
  PERMANENT = "PERMANENT",       // Standing operational team (e.g. Core Frontend)
  PROJECT = "PROJECT",           // Temporary project squad (e.g. Mobile V2 Launch)
  VIRTUAL = "VIRTUAL",           // Cross-department taskforce (e.g. Security Audit)
  SQUAD = "SQUAD",               // Agile feature squad
}

export enum TeamMemberRole {
  LEAD = "LEAD",
  CO_LEAD = "CO_LEAD",
  SCRUM_MASTER = "SCRUM_MASTER",
  MEMBER = "MEMBER",
  CONTRIBUTOR = "CONTRIBUTOR",
}

export enum TeamReportingType {
  MANAGER = "MANAGER",                   // Reports to a specific Line Manager Employee
  DEPARTMENT_HEAD = "DEPARTMENT_HEAD",   // Reports to the Head of Department
  TEAM = "TEAM",                         // Sub-team reporting to a Parent Team Lead
  ORG_NODE = "ORG_NODE",                 // Reports to a specific Node in Org Tree (e.g. VP/Director)
}

// 1. TEAM DOCUMENT INTERFACE
export interface TeamDocument extends OrgLevelDocument {
  name: string;
  code: string;
  description?: string;
  type: TeamType;
  branchId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  isCrossFunctional: boolean;
  leadId?: mongoose.Types.ObjectId;        // Employee who leads this team
  
  // Who does this entire team report to?
  reporting: {
    type: TeamReportingType;
    targetId?: mongoose.Types.ObjectId;    // ID of Manager, Department, Parent Team, or OrgNode
    targetName?: string;                   // Human-readable reference label
  };

  // Operational Rules
  maxConcurrentLeaves?: number;           // Max members allowed on leave on same day
  shiftId?: mongoose.Types.ObjectId;      // Dedicated team shift
  tags?: string[];
  startDate?: Date;
  endDate?: Date;                          // For temporary project teams
  isActive: boolean;
  isDeleted: boolean;
}

// 2. TEAM MEMBER INTERFACE (Many-to-Many Mapping)
export interface TeamMemberDocument extends OrgLevelDocument {
  teamId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  roleInTeam: TeamMemberRole;
  isPrimary: boolean;                      // Primary team for default leave/approval routing
  allocationPercentage: number;            // 1-100% capacity in this team
  joinedAt: Date;
  leftAt?: Date | null;
  isActive: boolean;
  isDeleted: boolean;
}

// 3. TEAM SCHEMA
const TeamSchema = createOrgLevelSchema<TeamDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: Object.values(TeamType),
      default: TeamType.PERMANENT,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    isCrossFunctional: {
      type: Boolean,
      default: false,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    reporting: {
      type: {
        type: String,
        enum: Object.values(TeamReportingType),
        default: TeamReportingType.DEPARTMENT_HEAD,
      },
      targetId: {
        type: Schema.Types.ObjectId,
        default: null,
      },
      targetName: {
        type: String,
        trim: true,
        default: "",
      },
    },
    maxConcurrentLeaves: {
      type: Number,
      default: null,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { collection: "teams" }
);

TeamSchema.index({ tenantId: 1, code: 1 }, { unique: true });
TeamSchema.index({ tenantId: 1, departmentId: 1 });
TeamSchema.index({ tenantId: 1, leadId: 1 });

// 4. TEAM MEMBER SCHEMA
const TeamMemberSchema = createOrgLevelSchema<TeamMemberDocument>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    roleInTeam: {
      type: String,
      enum: Object.values(TeamMemberRole),
      default: TeamMemberRole.MEMBER,
    },
    isPrimary: {
      type: Boolean,
      default: true,
    },
    allocationPercentage: {
      type: Number,
      default: 100,
      min: 1,
      max: 100,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { collection: "team_members" }
);

TeamMemberSchema.index({ tenantId: 1, teamId: 1, employeeId: 1 }, { unique: true });
TeamMemberSchema.index({ tenantId: 1, employeeId: 1, isActive: 1 });

// 5. EXPORT MODELS
export const TeamModel: Model<TeamDocument> = mongoose.model<TeamDocument>("Team", TeamSchema);
export const TeamMemberModel: Model<TeamMemberDocument> = mongoose.model<TeamMemberDocument>("TeamMember", TeamMemberSchema);
