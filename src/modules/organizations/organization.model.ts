import mongoose,{Document} from "mongoose";
import { createPlatformSchema } from "../../core/database/base.schema";

export interface OrganizationDocument extends Document {
  companyName:      string;
  slug:             string;
  legalName?:       string;
  cin?:             string;
  gstin?:           string;
  pan?:             string;
  tan?:             string;
  industry?:        string;
  employeeStrength: number;
  phone?:           string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    city?:         string;
    state?:        string;
    countryCode?:  string;
    zip?:          string;
  };
  branding?: {
    logoUrl?:      string;
    primaryColor?: string;
    website?:      string;
    supportEmail?: string;
    supportPhone?: string;
  };
  locale: {
    currencyCode:       string;
    timezone:           string;
    countryCode:        string;
    dateFormat:         string;
    timeFormat:         string;
    fiscalYearStart:    string;
    weeklyOffDays:      string[];
    workingHoursPerDay: number;
  };
  subscription: {
    plan:          string;
    status:        string;
    trialEndsAt?:  Date;
    renewsAt?:     Date;
    maxEmployees:  number;
    maxBranches:   number;
  };
  modules: {
    attendance:  boolean;
    leave:       boolean;
    payroll:     boolean;
    performance: boolean;
    recruitment: boolean;
    assets:      boolean;
  };
  statutory: {
    pfEnabled:  boolean;
    esiEnabled: boolean;
    tdsEnabled: boolean;
    ptEnabled:  boolean;
    lwfEnabled: boolean;
  };
  isActive:  boolean;
  isDeleted: boolean;
  version:   number;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATION SCHEMA
// Uses createPlatformSchema — organization IS the tenant
// No tenantId on this collection — _id IS the tenantId
// ─────────────────────────────────────────────────────────────────────────────

const OrganizationSchema = createPlatformSchema<OrganizationDocument>({

  companyName: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 200,
  },
  slug: {
    // URL-safe unique identifier — "abc-technologies"
    // Used in subdomain routing + Redis cache keys
    type:      String,
    required:  true,
    unique:    true,
    trim:      true,
    lowercase: true,
    match:     /^[a-z0-9-]+$/,
    maxlength: 100,
  },
  legalName: {
    type:      String,
    trim:      true,
    maxlength: 300,
  },

  // Indian statutory identifiers
  cin:  { type: String, trim: true, uppercase: true },
  gstin:{ type: String, trim: true, uppercase: true },
  pan:  { type: String, trim: true, uppercase: true },
  tan:  { type: String, trim: true, uppercase: true },

  industry:         { type: String, trim: true },
  employeeStrength: { type: Number, default: 0 },
  phone:            { type: String, trim: true },

  // Embedded address
  address: {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city:         { type: String, trim: true },
    state:        { type: String, trim: true },
    countryCode:  { type: String, trim: true, uppercase: true },
    zip:          { type: String, trim: true },
  },

  // Embedded branding
  branding: {
    logoUrl:      { type: String },
    primaryColor: { type: String, default: "#2886CE" },
    website:      { type: String },
    supportEmail: { type: String, lowercase: true },
    supportPhone: { type: String },
  },

  // Embedded locale settings
  locale: {
    currencyCode:       { type: String, default: "INR",          uppercase: true },
    timezone:           { type: String, default: "Asia/Kolkata"               },
    countryCode:        { type: String, default: "IN",           uppercase: true },
    dateFormat:         { type: String, default: "DD/MM/YYYY"                 },
    timeFormat:         { type: String, default: "12h"                        },
    fiscalYearStart:    { type: String, default: "April"                      },
    weeklyOffDays:      { type: [String], default: ["Saturday", "Sunday"]     },
    workingHoursPerDay: { type: Number,  default: 8                           },
  },

  // Embedded subscription
  subscription: {
    plan: {
      type:    String,
      enum:    ["free", "starter", "growth", "enterprise"],
      default: "free",
    },
    status: {
      type:    String,
      enum:    ["trial", "active", "past_due", "cancelled", "suspended"],
      default: "trial",
    },
    trialEndsAt:  { type: Date },
    renewsAt:     { type: Date },
    maxEmployees: { type: Number, default: 10  },
    maxBranches:  { type: Number, default: 1   },
  },

  // Embedded module flags — controls which modules are active
  modules: {
    attendance:  { type: Boolean, default: true  },
    leave:       { type: Boolean, default: true  },
    payroll:     { type: Boolean, default: false },
    performance: { type: Boolean, default: false },
    recruitment: { type: Boolean, default: false },
    assets:      { type: Boolean, default: false },
  },

  // Embedded statutory controls — Indian payroll compliance
  statutory: {
    pfEnabled:  { type: Boolean, default: false },
    esiEnabled: { type: Boolean, default: false },
    tdsEnabled: { type: Boolean, default: true  },
    ptEnabled:  { type: Boolean, default: false },
    lwfEnabled: { type: Boolean, default: false },
  },

  isActive: { type: Boolean, default: true },
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

OrganizationSchema.index({ slug: 1 },                   { unique: true });
OrganizationSchema.index({ "subscription.status": 1 });
OrganizationSchema.index({ isActive: 1, isDeleted: 1 });
OrganizationSchema.index({ gstin: 1 },                  { sparse: true });
OrganizationSchema.index({ pan: 1 },                    { sparse: true });

export const OrganizationModel = mongoose.model<OrganizationDocument>(
  "Organization",
  OrganizationSchema
);