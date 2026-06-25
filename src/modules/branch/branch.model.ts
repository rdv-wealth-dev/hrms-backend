import mongoose,{Document} from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";


export interface BranchDocument extends BaseDocument {
  name:         string;
  code:         string;
  isHeadOffice: boolean;
  isActive:     boolean;
  parentBranchId?: mongoose.Types.ObjectId;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    landmark?:     string;
    city?:         string;
    state?:        string;
    countryCode?:  string;
    zip?:          string;
  };
  contact?: {
    phone?: string;
    email?: string;
  };
  geo?: {
    lat?:                  number;
    lng?:                  number;
    geofenceRadiusMeters?: number;
    geofenceEnabled?:      boolean;
  };
  workPolicy?: {
    timezone?:           string;
    weeklyOffDays?:      string[];
    shiftStartTime?:     string;
    shiftEndTime?:       string;
    workingHoursPerDay?: number;
  };
  statutory?: {
    pfApplicable?:  boolean | null;
    esiApplicable?: boolean | null;
    ptApplicable?:  boolean | null;
    ptStateCode?:   string;
  };
}

// BRANCH SCHEMA
// Uses createBaseSchema — branch has tenantId + branchId
// Wait — branch IS a branch, so branchId refers to itself
// We override branchId as optional here since branch itself
// does not need to reference another branch

const BranchSchema = createBaseSchema<BranchDocument>({
  name: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 200,
  },
  code: {
    // Short identifier — "HQ", "BLR-01", "MUM-02"
    type:      String,
    required:  true,
    trim:      true,
    uppercase: true,
    maxlength: 20,
  },
  isHeadOffice: {
    type:    Boolean,
    default: false,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
  parentBranchId: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     "Branch",
    default: null,
  },
  address: {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    landmark:     { type: String, trim: true },
    city:         { type: String, trim: true },
    state:        { type: String, trim: true },
    countryCode:  { type: String, trim: true, uppercase: true },
    zip:          { type: String, trim: true },
  },
  contact: {
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  geo: {
    lat:                  { type: Number },
    lng:                  { type: Number },
    geofenceRadiusMeters: { type: Number, default: 200 },
    geofenceEnabled:      { type: Boolean, default: false },
  },
  workPolicy: {
    timezone:           { type: String },
    weeklyOffDays:      { type: [String] },
    shiftStartTime:     { type: String },
    shiftEndTime:       { type: String },
    workingHoursPerDay: { type: Number },
  },
  statutory: {
    pfApplicable:  { type: Boolean, default: null },
    esiApplicable: { type: Boolean, default: null },
    ptApplicable:  { type: Boolean, default: null },
    ptStateCode:   { type: String,  trim: true    },
  },
}, {
  // Override — branch's own branchId field is itself
  // so we make the inherited branchId optional here
  collection: "branches",
});

// Override branchId to be optional on Branch collection
// Branch IS a branch — it does not reference another branch as parent
// parentBranchId handles hierarchy separately
BranchSchema.path("branchId").required(false);

// INDEXES

BranchSchema.index({ tenantId: 1, code: 1 },        { unique: true });
BranchSchema.index({ tenantId: 1, isHeadOffice: 1 });
BranchSchema.index({ tenantId: 1, isActive: 1     });
BranchSchema.index({ tenantId: 1, isDeleted: 1    });

// STATICS

BranchSchema.statics.getHeadOffice = function (tenantId: string) {
  return this.findOne({ tenantId, isHeadOffice: true, isDeleted: false });
};

export const BranchModel = mongoose.model<BranchDocument>(
  "Branch",
  BranchSchema
);