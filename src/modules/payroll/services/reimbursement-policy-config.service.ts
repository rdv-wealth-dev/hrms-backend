import mongoose from "mongoose";
import {
  ReimbursementPolicyConfigModel,
  ReimbursementPolicyConfigDocument,
} from "../models/reimbursement-policy-config.model";
import { ReimbursementModel, ReimbursementCategory, ReimbursementStatus } from "../models/reimbursement.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import { UpsertReimbursementPolicyInput } from "../dto/reimbursement.dto";

// ─────────────────────────────────────────────────────────────────────────────
// SENSIBLE DEFAULTS — mirrors model field defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POLICY = {
  allowedCategories: [] as ReimbursementCategory[], // empty = all allowed
  categoryLimits: [],
  maxClaimsPerMonth: 0,        // 0 = unlimited
  approvalThresholdAmount: 0,  // 0 = disabled
  claimDeadlineDays: 0,        // 0 = no deadline
  blockOnLimitExceeded: true,
  isActive: true,
};

export class ReimbursementPolicyConfigService {
  // ─────────────────────────────────────────────────────────────────────────
  // GET POLICY
  // ─────────────────────────────────────────────────────────────────────────

  async getPolicy(
    tenantId: string
  ): Promise<any> {
    const policy = await ReimbursementPolicyConfigModel.findOne({
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
    input: UpsertReimbursementPolicyInput
  ): Promise<ReimbursementPolicyConfigDocument> {
    const tenantOid = new mongoose.Types.ObjectId(context.tenantId);

    const existing = await ReimbursementPolicyConfigModel.findOne({
      tenantId: tenantOid,
      isDeleted: false,
    });

    if (existing) {
      Object.assign(existing, input, {
        updatedBy: new mongoose.Types.ObjectId(context.userId),
      });
      await existing.save();
      return existing;
    }

    const policy = await ReimbursementPolicyConfigModel.create({
      tenantId: tenantOid,
      createdBy: new mongoose.Types.ObjectId(context.userId),
      ...input,
    });

    return policy;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATE CLAIM AGAINST POLICY
  // Called in ReimbursementService.createClaim before saving.
  // Returns a warnings array for non-blocking issues (when blockOnLimitExceeded=false).
  // Raises AppError for hard violations.
  // ─────────────────────────────────────────────────────────────────────────

  async validateClaimAgainstPolicy(
    context: RequestContext,
    employeeId: string,
    input: {
      category: ReimbursementCategory;
      amount: number;
      expenseDate: string;
    }
  ): Promise<{ warnings: string[] }> {
    const policy = await this.getPolicy(context.tenantId);
    const warnings: string[] = [];
    const tenantOid = new mongoose.Types.ObjectId(context.tenantId);
    const employeeOid = new mongoose.Types.ObjectId(employeeId);
    const expenseMonth = new Date(input.expenseDate).getMonth() + 1;
    const expenseYear = new Date(input.expenseDate).getFullYear();

    // ── Rule 1: Category allowed? ─────────────────────────────────────────
    if (
      policy.allowedCategories.length > 0 &&
      !policy.allowedCategories.includes(input.category)
    ) {
      throw new AppError(
        `Reimbursement category '${input.category}' is not permitted under the current policy.`,
        400
      );
    }

    // ── Rule 2: Max claims per month ──────────────────────────────────────
    if (policy.maxClaimsPerMonth > 0) {
      const monthStart = new Date(expenseYear, expenseMonth - 1, 1);
      const monthEnd = new Date(expenseYear, expenseMonth, 0, 23, 59, 59);

      const claimsThisMonth = await ReimbursementModel.countDocuments({
        tenantId: tenantOid,
        employeeId: employeeOid,
        expenseDate: { $gte: monthStart, $lte: monthEnd },
        status: { $nin: [ReimbursementStatus.CANCELLED, ReimbursementStatus.REJECTED] },
        isDeleted: false,
      });

      if (claimsThisMonth >= policy.maxClaimsPerMonth) {
        throw new AppError(
          `Maximum of ${policy.maxClaimsPerMonth} claim(s) per month has been reached. ` +
          `No further claims can be submitted for this period.`,
          400
        );
      }
    }

    // ── Rule 3: Per-category monthly limit ────────────────────────────────
    const catLimit = policy.categoryLimits?.find(
      (cl: any) => cl.category === input.category
    );

    if (catLimit && catLimit.monthlyLimit > 0) {
      const monthStart = new Date(expenseYear, expenseMonth - 1, 1);
      const monthEnd = new Date(expenseYear, expenseMonth, 0, 23, 59, 59);

      const monthlySpend = await ReimbursementModel.aggregate([
        {
          $match: {
            tenantId: tenantOid,
            employeeId: employeeOid,
            category: input.category,
            expenseDate: { $gte: monthStart, $lte: monthEnd },
            status: {
              $in: [ReimbursementStatus.PENDING, ReimbursementStatus.APPROVED, ReimbursementStatus.PAID],
            },
            isDeleted: false,
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const currentTotal = monthlySpend[0]?.total ?? 0;
      const projectedTotal = currentTotal + input.amount;

      if (projectedTotal > catLimit.monthlyLimit) {
        const message =
          `This claim (₹${input.amount.toLocaleString("en-IN")}) would bring your total ` +
          `${input.category} expenses for this month to ₹${projectedTotal.toLocaleString("en-IN")}, ` +
          `exceeding the monthly limit of ₹${catLimit.monthlyLimit.toLocaleString("en-IN")}.`;

        if (policy.blockOnLimitExceeded) {
          throw new AppError(message, 400);
        }
        warnings.push(`LIMIT_EXCEEDED: ${message}`);
      }
    }

    // ── Rule 4: Claim submission deadline ─────────────────────────────────
    if (policy.claimDeadlineDays > 0) {
      const expDate = new Date(input.expenseDate);
      const expMonthEnd = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0);
      const deadline = new Date(expMonthEnd);
      deadline.setDate(deadline.getDate() + policy.claimDeadlineDays);

      if (new Date() > deadline) {
        throw new AppError(
          `The submission deadline for expenses in ${expDate.toLocaleString("en-IN", { month: "long", year: "numeric" })} ` +
          `was ${deadline.toLocaleDateString("en-IN")}. Claims can no longer be submitted for this period.`,
          400
        );
      }
    }

    return { warnings };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET SUMMARY — spend vs. limits dashboard for an employee
  // ─────────────────────────────────────────────────────────────────────────

  async getSummary(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number
  ) {
    const policy = await this.getPolicy(tenantId);
    const tenantOid = new mongoose.Types.ObjectId(tenantId);
    const employeeOid = new mongoose.Types.ObjectId(employeeId);

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    // Total claims this month by category
    const spendByCategory = await ReimbursementModel.aggregate([
      {
        $match: {
          tenantId: tenantOid,
          employeeId: employeeOid,
          expenseDate: { $gte: monthStart, $lte: monthEnd },
          status: {
            $in: [ReimbursementStatus.PENDING, ReimbursementStatus.APPROVED, ReimbursementStatus.PAID],
          },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          approvedAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", ReimbursementStatus.APPROVED] }, "$approvedAmount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const spendMap = new Map(spendByCategory.map((s: any) => [s._id, s]));

    // Enrich with policy limits
    const categories = Object.values(ReimbursementCategory).map((cat) => {
      const catLimit = policy.categoryLimits?.find((cl: any) => cl.category === cat);
      const spend = spendMap.get(cat);

      return {
        category: cat,
        spent: spend?.totalAmount ?? 0,
        approvedAmount: spend?.approvedAmount ?? 0,
        claimsCount: spend?.count ?? 0,
        monthlyLimit: catLimit?.monthlyLimit ?? 0, // 0 = unlimited
        annualLimit: catLimit?.annualLimit ?? 0,
        remainingMonthly:
          catLimit && catLimit.monthlyLimit > 0
            ? Math.max(0, catLimit.monthlyLimit - (spend?.totalAmount ?? 0))
            : null, // null = unlimited
        requiresReceipt: catLimit?.requiresReceipt ?? false,
        requiresApproval: catLimit?.requiresApproval ?? true,
      };
    });

    const totalSpent = spendByCategory.reduce((s: number, c: any) => s + c.totalAmount, 0);
    const totalClaims = spendByCategory.reduce((s: number, c: any) => s + c.count, 0);

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      totalSpent,
      totalClaims,
      maxClaimsPerMonth: policy.maxClaimsPerMonth,
      claimsRemaining:
        policy.maxClaimsPerMonth > 0
          ? Math.max(0, policy.maxClaimsPerMonth - totalClaims)
          : null,
      categories,
    };
  }
}
