import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";
// BRANCH DOCUMENT INTERFACE

export interface BranchDocument extends BaseDocument {
  name:            string;
  code:            string;
  isHeadOffice:    boolean;
  isActive:        boolean;
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
// Uses createBaseSchema — inherits tenantId + branchId + base fields
// branchId overridden to optional — branch does not reference itself
// parentBranchId handles branch hierarchy separately

const BranchSchema = createBaseSchema<BranchDocument>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    code: {
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
      geofenceRadiusMeters: { type: Number,  default: 100   },
      geofenceEnabled:      { type: Boolean, default: false },
    },
    workPolicy: {
      timezone:           { type: String   },
      weeklyOffDays:      { type: [String] },
      shiftStartTime:     { type: String   },
      shiftEndTime:       { type: String   },
      workingHoursPerDay: { type: Number   },
    },
    statutory: {
      pfApplicable:  { type: Boolean, default: null },
      esiApplicable: { type: Boolean, default: null },
      ptApplicable:  { type: Boolean, default: null },
      ptStateCode:   { type: String,  trim: true    },
    },
  },
  {
    collection: "branches",
  }
);
// OVERRIDE — branchId not required on Branch collection
// Branch IS a branch — branchId self-reference not needed
// parentBranchId handles hierarchy

BranchSchema.path("branchId").required(false);

// INDEXES
// tenantId always first in every compound index

BranchSchema.index({ tenantId: 1, code: 1 },         { unique: true });
BranchSchema.index({ tenantId: 1, isHeadOffice: 1 });
BranchSchema.index({ tenantId: 1, isActive: 1     });
BranchSchema.index({ tenantId: 1, isDeleted: 1    });

// STATICS

BranchSchema.statics.getHeadOffice = function (tenantId: string) {
  return this.findOne({
    tenantId,
    isHeadOffice: true,
    isDeleted:    false,
  });
};

// EXPORT

export const BranchModel = mongoose.model<BranchDocument>(
  "Branch",
  BranchSchema
);