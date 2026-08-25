import mongoose, { Schema } from "mongoose";
import { BaseDocument } from "../../shared/database/base.model";

export enum CustomFieldType {
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  DATE = "DATE",
  SELECT = "SELECT",             // Single-select dropdown or radio pill
  MULTI_SELECT = "MULTI_SELECT", // Multi-select dropdown or checkboxes
  BOOLEAN = "BOOLEAN",           // Yes / No switch
}

export enum CustomFieldScope {
  ORGANIZATION = "ORGANIZATION",
  BRANCH = "BRANCH",
  DEPARTMENT = "DEPARTMENT",
}

export enum CustomFieldUIComponent {
  DROPDOWN = "DROPDOWN",       // Standard HTML Select dropdown
  RADIO_GROUP = "RADIO_GROUP", // Radio buttons / Pill buttons (Beginner friendly: e.g. [WFO] [WFH] [HYBRID])
  PILL_SELECT = "PILL_SELECT", // Modern clickable tag / pill selector
  TEXT_INPUT = "TEXT_INPUT",   // Textbox
  SWITCH = "SWITCH",           // Toggle switch
}

export interface CustomFieldOption {
  label: string; // User-facing label e.g. "Work From Office (WFO)"
  value: string; // Database stored value e.g. "WFO"
  description?: string; // Optional beginner helper text e.g. "Working directly from company branch"
  color?: string; // Badge color e.g. "#2886CE"
}

export interface CustomFieldDocument extends BaseDocument {
  tenantId: mongoose.Types.ObjectId;
  fieldLabel: string;        // e.g. "Office Type" or "Work Mode"
  fieldKey: string;          // e.g. "officeType" (auto-slugified)
  fieldType: CustomFieldType;
  uiComponent: CustomFieldUIComponent; // UI component to render (e.g. RADIO_GROUP for WFO/WFH)
  scope: CustomFieldScope;
  branchId?: mongoose.Types.ObjectId;      // when scope === "BRANCH"
  departmentId?: mongoose.Types.ObjectId;  // when scope === "DEPARTMENT"
  wizardStep: number;        // Which wizard step (1 to 5, default 1)
  section: string;           // Section header e.g. "WORK_DETAILS", "PERSONAL_DETAILS"
  options?: (string | CustomFieldOption)[]; // Support both simple strings ["WFO", "WFH"] and rich objects
  placeholder?: string;
  helperText?: string;       // Beginner friendly helper tooltip
  defaultValue?: any;        // Default pre-selected value e.g. "WFO"
  isRequired: boolean;
  order: number;             // For display sequence ordering
  showInOnboarding: boolean; // Whether visible during self-service onboarding
  showInBulkImport: boolean; // Whether included as a column in bulk import template
  isActive: boolean;
  isDeleted: boolean;
}

const CustomFieldSchema = new Schema<CustomFieldDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    fieldLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fieldKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    fieldType: {
      type: String,
      enum: Object.values(CustomFieldType),
      default: CustomFieldType.TEXT,
      required: true,
    },
    uiComponent: {
      type: String,
      enum: Object.values(CustomFieldUIComponent),
      default: CustomFieldUIComponent.DROPDOWN,
    },
    scope: {
      type: String,
      enum: Object.values(CustomFieldScope),
      default: CustomFieldScope.ORGANIZATION,
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    wizardStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    section: {
      type: String,
      default: "PERSONAL_DETAILS",
      trim: true,
    },
    options: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    placeholder: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    helperText: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    defaultValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    showInOnboarding: {
      type: Boolean,
      default: true,
    },
    showInBulkImport: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of fieldKey per tenant & scope targets
CustomFieldSchema.index(
  { tenantId: 1, fieldKey: 1, scope: 1, branchId: 1, departmentId: 1, isDeleted: 1 },
  { unique: true }
);

CustomFieldSchema.index({ tenantId: 1, wizardStep: 1, order: 1 });

export const CustomFieldModel = mongoose.model<CustomFieldDocument>(
  "CustomField",
  CustomFieldSchema
);
