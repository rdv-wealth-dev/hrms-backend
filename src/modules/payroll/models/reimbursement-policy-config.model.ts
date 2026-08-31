import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";
import { ReimbursementCategory } from "./reimbursement.model";

// ─────────────────────────────────────────────────────────────────────────────
// PER-CATEGORY LIMIT RULES
// HR defines monthly and annual caps, receipt requirements, and approval rules
// independently for each expense category.
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryLimit {
  category: ReimbursementCategory;
  monthlyLimit: number;  // 0 = unlimited
  annualLimit: number;   // 0 = unlimited
  requiresReceipt: boolean;
  requiresApproval: boolean; // false = auto-approve on submission (trusted categories)
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface ReimbursementPolicyConfigDocument extends OrgLevelDocument {
  /** Allowed categories — empty array means ALL categories are permitted */
  allowedCategories: ReimbursementCategory[];

  /** Per-category limits; unlisted categories fall back to global defaults */
  categoryLimits: CategoryLimit[];

  /** Max number of claims an employee may submit per calendar month (0 = unlimited) */
  maxClaimsPerMonth: number;

  /**
   * Claims equal to or above this amount always require manager approval,
   * regardless of the category-level requiresApproval setting.
   * 0 = disabled (category setting applies).
   */
  approvalThresholdAmount: number;

  /**
   * Days after month end within which an employee may submit expenses
   * for the prior month. e.g. 15 means Jan expenses can be submitted until Feb 15.
   * 0 = no deadline enforced.
   */
  claimDeadlineDays: number;

  /**
   * When true, claims that exceed the category monthly limit are blocked at submission.
   * When false, they are allowed through but flagged with a warning in the response.
   */
  blockOnLimitExceeded: boolean;

  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const CategoryLimitSchema = new mongoose.Schema<CategoryLimit>(
  {
    category: {
      type: String,
      enum: Object.values(ReimbursementCategory),
      required: true,
    },
    monthlyLimit: { type: Number, default: 0, min: 0 },
    annualLimit: { type: Number, default: 0, min: 0 },
    requiresReceipt: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const ReimbursementPolicyConfigSchema = createOrgLevelSchema<ReimbursementPolicyConfigDocument>(
  {
    allowedCategories: {
      type: [String],
      enum: Object.values(ReimbursementCategory),
      default: [], // Empty = all categories permitted
    },
    categoryLimits: {
      type: [CategoryLimitSchema],
      default: [],
    },
    maxClaimsPerMonth: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    approvalThresholdAmount: {
      type: Number,
      default: 0, // 0 = disabled
      min: 0,
    },
    claimDeadlineDays: {
      type: Number,
      default: 0, // 0 = no deadline
      min: 0,
    },
    blockOnLimitExceeded: {
      type: Boolean,
      default: true, // Block by default — safer for financial compliance
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { collection: "payroll_reimbursement_policy_configs" }
);

// One active policy per tenant
ReimbursementPolicyConfigSchema.index({ tenantId: 1 }, { unique: true });

export const ReimbursementPolicyConfigModel = mongoose.model<ReimbursementPolicyConfigDocument>(
  "ReimbursementPolicyConfig",
  ReimbursementPolicyConfigSchema
);
