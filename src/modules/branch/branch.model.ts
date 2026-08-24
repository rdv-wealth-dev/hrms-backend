import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../shared/database/base.schema";
import { CustomWeekOffRule } from "../attendance/services/schedule-engine.service";

export { CustomWeekOffRule };
// BRANCH DOCUMENT INTERFACE

export interface BranchDocument extends BaseDocument {
  name: string;
  code: string;
  legalEntityName?: string;
  countryCode?: string; // ISO 2-letter e.g. "IN", "US", "GB", "AE", "SG"
  currency?: string; // ISO 3-letter e.g. "INR", "USD", "GBP", "AED", "SGD"
  taxRegistrationNumber?: string; // GSTIN/PAN, EIN, VAT, etc.
  stateOrRegionCode?: string; // State/Region code e.g. "MH", "CA", "ENG", "DXB"
  isHeadquarters?: boolean;
  isHeadOffice: boolean;
  isActive: boolean;
  parentBranchId?: mongoose.Types.ObjectId;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    landmark?: string;
    city?: string;
    state?: string;
    countryCode?: string;
    zip?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
  };
  geo?: {
    lat?: number;
    lng?: number;
    geofenceRadiusMeters?: number;
    geofenceEnabled?: boolean;
  };
  workPolicy?: {
    timezone?: string;
    weeklyOffDays?: string[];
    shiftStartTime?: string;
    shiftEndTime?: string;
    workingHoursPerDay?: number;
    customWeekOffRules?: CustomWeekOffRule[];
    ipRestrictionEnabled?: boolean;
    allowedIpAddresses?: string[];
  };
  statutory?: {
    pfApplicable?: boolean | null;
    esiApplicable?: boolean | null;
    ptApplicable?: boolean | null;
    ptStateCode?: string;
  };
  defaultShiftId?: mongoose.Types.ObjectId; // Branch-level default shift (overrides org default)
}
// BRANCH SCHEMA
// Uses createBaseSchema — inherits tenantId + branchId + base fields
// branchId overridden to optional — branch does not reference itself
// parentBranchId handles branch hierarchy separately

const BranchSchema = createBaseSchema<BranchDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    legalEntityName: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "IN",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR",
    },
    taxRegistrationNumber: {
      type: String,
      trim: true,
    },
    stateOrRegionCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isHeadquarters: {
      type: Boolean,
      default: false,
    },
    isHeadOffice: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    parentBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    address: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      landmark: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      countryCode: { type: String, trim: true, uppercase: true },
      zip: { type: String, trim: true },
    },
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
      geofenceRadiusMeters: { type: Number, default: 100 },
      geofenceEnabled: { type: Boolean, default: false },
    },
    workPolicy: {
      timezone: { type: String },
      weeklyOffDays: { type: [String] },
      shiftStartTime: { type: String },
      shiftEndTime: { type: String },
      workingHoursPerDay: { type: Number },
      customWeekOffRules: [{
        dayOfWeek: { type: String, required: true },
        weeks: { type: [Number], required: true },
      }],
      ipRestrictionEnabled: { type: Boolean, default: false },
      allowedIpAddresses: { type: [String], default: [] },
    },
    statutory: {
      pfApplicable: { type: Boolean, default: null },
      esiApplicable: { type: Boolean, default: null },
      ptApplicable: { type: Boolean, default: null },
      ptStateCode: { type: String, trim: true },
    },
    // Branch-level default shift — used as middle tier in resolution:
    // Employee Shift → Branch Default Shift → Org Default Shift
    defaultShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
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

BranchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
BranchSchema.index({ tenantId: 1, isHeadOffice: 1 });
BranchSchema.index({ tenantId: 1, isActive: 1 });
BranchSchema.index({ tenantId: 1, isDeleted: 1 });

// STATICS

BranchSchema.statics.getHeadOffice = function (tenantId: string) {
  return this.findOne({
    tenantId,
    isHeadOffice: true,
    isDeleted: false,
  });
};

// EXPORT

export const BranchModel = mongoose.model<BranchDocument>(
  "Branch",
  BranchSchema
);