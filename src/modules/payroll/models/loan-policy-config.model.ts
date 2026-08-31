import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";
import { LoanType } from "./loan.model";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export enum InterestMethod {
  FLAT = "FLAT",                         // Total interest = P × r × t (simple)
  REDUCING_BALANCE = "REDUCING_BALANCE", // EMI = P × r(1+r)^n / ((1+r)^n - 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-TYPE LIMIT
// HR can set different principal caps per loan type
// ─────────────────────────────────────────────────────────────────────────────

export interface LoanTypeLimit {
  loanType: LoanType;
  maxPrincipalAmount: number;            // e.g. SALARY_ADVANCE → ₹50,000
  defaultInterestRatePercent: number;    // 0 = interest-free
  maxTenureMonths: number;               // e.g. 6 for advance, 24 for personal
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface LoanPolicyConfigDocument extends OrgLevelDocument {
  /** One active policy per tenant */
  allowedLoanTypes: LoanType[];

  /** Per-type principal & tenure caps. Overrides global maxPrincipalAmount. */
  typeLimits: LoanTypeLimit[];

  /** Fallback if no typeLimits entry — global ceiling across all types */
  globalMaxPrincipalAmount: number;

  /** Default interest method for new loans (can be overridden per-loan) */
  defaultInterestMethod: InterestMethod;

  /** Max simultaneous active loans an employee may hold */
  maxActiveLoanCountPerEmployee: number;

  /**
   * Safety guard: total EMI deductions across all loans must not exceed
   * this % of gross monthly salary. Prevents negative net-pay at engine time.
   * 0 = disabled.
   */
  maxEmiAsPercentOfGross: number;

  /**
   * When true, HR/Admin-created loans (employeeId provided) are immediately
   * set ACTIVE, skipping the PENDING → APPROVED workflow.
   */
  adminCreatedLoansAutoApprove: boolean;

  /**
   * When true, employee self-apply is allowed (POST /loans without employeeId).
   * When false, only HR can create loans.
   */
  allowEmployeeSelfApply: boolean;

  /** Auto-deduct EMIs from payroll every cycle. Can be disabled for manual repayment orgs. */
  autoDeductFromPayroll: boolean;

  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const LoanTypeLimitSchema = new mongoose.Schema<LoanTypeLimit>(
  {
    loanType: {
      type: String,
      enum: Object.values(LoanType),
      required: true,
    },
    maxPrincipalAmount: { type: Number, required: true, min: 0 },
    defaultInterestRatePercent: { type: Number, default: 0, min: 0, max: 100 },
    maxTenureMonths: { type: Number, required: true, min: 1, max: 120 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const LoanPolicyConfigSchema = createOrgLevelSchema<LoanPolicyConfigDocument>(
  {
    allowedLoanTypes: {
      type: [String],
      enum: Object.values(LoanType),
      default: Object.values(LoanType),
    },
    typeLimits: {
      type: [LoanTypeLimitSchema],
      default: [],
    },
    globalMaxPrincipalAmount: {
      type: Number,
      default: 500_000, // ₹5 Lakh fallback ceiling
      min: 0,
    },
    defaultInterestMethod: {
      type: String,
      enum: Object.values(InterestMethod),
      default: InterestMethod.FLAT,
    },
    maxActiveLoanCountPerEmployee: {
      type: Number,
      default: 2,
      min: 1,
    },
    maxEmiAsPercentOfGross: {
      type: Number,
      default: 50, // 50% gross — keeps net pay positive
      min: 0,
      max: 100,
    },
    adminCreatedLoansAutoApprove: {
      type: Boolean,
      default: true,
    },
    allowEmployeeSelfApply: {
      type: Boolean,
      default: true,
    },
    autoDeductFromPayroll: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { collection: "payroll_loan_policy_configs" }
);

// One active policy per tenant
LoanPolicyConfigSchema.index({ tenantId: 1 }, { unique: true });

export const LoanPolicyConfigModel = mongoose.model<LoanPolicyConfigDocument>(
  "LoanPolicyConfig",
  LoanPolicyConfigSchema
);
