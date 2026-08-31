import mongoose from "mongoose";
import {
  LoanPolicyConfigModel,
  LoanPolicyConfigDocument,
  InterestMethod,
} from "../models/loan-policy-config.model";
import { LoanType } from "../models/loan.model";
import { LoanModel, LoanStatus } from "../models/loan.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import { UpsertLoanPolicyInput } from "../dto/loan.dto";

// ─────────────────────────────────────────────────────────────────────────────
// SENSIBLE DEFAULTS
// Returned when no policy document exists for a tenant yet.
// Mirrors the model's field defaults so behaviour is consistent.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POLICY = {
  allowedLoanTypes: Object.values(LoanType),
  typeLimits: [],
  globalMaxPrincipalAmount: 500_000,
  defaultInterestMethod: InterestMethod.FLAT,
  maxActiveLoanCountPerEmployee: 2,
  maxEmiAsPercentOfGross: 50,
  adminCreatedLoansAutoApprove: true,
  allowEmployeeSelfApply: true,
  autoDeductFromPayroll: true,
  isActive: true,
};

export class LoanPolicyConfigService {
  // ─────────────────────────────────────────────────────────────────────────
  // GET POLICY
  // Returns the active policy doc or the in-memory defaults if not configured.
  // ─────────────────────────────────────────────────────────────────────────

  async getPolicy(tenantId: string): Promise<any> {
    const policy = await LoanPolicyConfigModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false,
    }).lean();

    return policy ?? DEFAULT_POLICY;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPSERT POLICY — HR saves/updates config
  // ─────────────────────────────────────────────────────────────────────────

  async upsertPolicy(
    context: RequestContext,
    input: UpsertLoanPolicyInput
  ): Promise<LoanPolicyConfigDocument> {
    const tenantOid = new mongoose.Types.ObjectId(context.tenantId);

    const existing = await LoanPolicyConfigModel.findOne({
      tenantId: tenantOid,
      isDeleted: false,
    });

    if (existing) {
      // Update all supplied fields
      Object.assign(existing, input, {
        updatedBy: new mongoose.Types.ObjectId(context.userId),
      });
      await existing.save();
      return existing;
    }

    // Create fresh policy
    const policy = await LoanPolicyConfigModel.create({
      tenantId: tenantOid,
      createdBy: new mongoose.Types.ObjectId(context.userId),
      ...input,
    });

    return policy;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATE LOAN AGAINST POLICY
  // Called in LoanService.createLoan before saving the document.
  // Raises AppError with a clear message on any violation.
  // ─────────────────────────────────────────────────────────────────────────

  async validateLoanAgainstPolicy(
    context: RequestContext,
    employeeId: string,
    input: {
      loanType: LoanType;
      principalAmount: number;
      tenureMonths: number;
      isEmployeeSelfApply: boolean;
    }
  ): Promise<void> {
    const policy = await this.getPolicy(context.tenantId);

    // ── Rule 1: Employee self-apply allowed? ──────────────────────────────
    if (input.isEmployeeSelfApply && !policy.allowEmployeeSelfApply) {
      throw new AppError(
        "Employees are not permitted to self-apply for loans. Contact HR to request a loan.",
        403
      );
    }

    // ── Rule 2: Loan type allowed? ────────────────────────────────────────
    if (!policy.allowedLoanTypes.includes(input.loanType)) {
      throw new AppError(
        `Loan type '${input.loanType}' is not permitted under the current loan policy.`,
        400
      );
    }

    // ── Rule 3: Max active loan count ─────────────────────────────────────
    const activeCount = await LoanModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: { $in: [LoanStatus.ACTIVE, LoanStatus.PENDING, LoanStatus.APPROVED] },
      isDeleted: false,
    });

    if (activeCount >= policy.maxActiveLoanCountPerEmployee) {
      throw new AppError(
        `Employee already has ${activeCount} active/pending loan(s). ` +
        `Maximum allowed is ${policy.maxActiveLoanCountPerEmployee}. ` +
        `Close an existing loan before applying for a new one.`,
        400
      );
    }

    // ── Rule 4: Principal cap ─────────────────────────────────────────────
    const typeLimit = policy.typeLimits?.find(
      (tl: any) => tl.loanType === input.loanType
    );

    const maxPrincipal = typeLimit?.maxPrincipalAmount ?? policy.globalMaxPrincipalAmount;
    if (maxPrincipal > 0 && input.principalAmount > maxPrincipal) {
      throw new AppError(
        `Principal amount ₹${input.principalAmount.toLocaleString("en-IN")} exceeds the ` +
        `maximum allowed of ₹${maxPrincipal.toLocaleString("en-IN")} for '${input.loanType}'.`,
        400
      );
    }

    // ── Rule 5: Tenure cap ────────────────────────────────────────────────
    const maxTenure = typeLimit?.maxTenureMonths ?? 120;
    if (input.tenureMonths > maxTenure) {
      throw new AppError(
        `Tenure of ${input.tenureMonths} months exceeds the maximum of ${maxTenure} months ` +
        `for '${input.loanType}'.`,
        400
      );
    }
  }
}
