import mongoose from "mongoose";
import { PayrollRunModel, PayrollRunStatus } from "../models/payroll-run.model";
import { LoanModel, LoanStatus } from "../models/loan.model";
import { ReimbursementModel, ReimbursementStatus } from "../models/reimbursement.model";
import { ArrearsBatchModel, ArrearsBatchStatus } from "../models/arrears-batch.model";
import { PayrollAdjustmentModel, AdjustmentStatus } from "../models/payroll-adjustment.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

export interface ApprovalItem {
  type: "PAYROLL_RUN" | "LOAN" | "REIMBURSEMENT" | "ARREARS_BATCH" | "ADJUSTMENT";
  refId: string;
  label: string;
  detail: string;
  amount?: number;
  requestedBy?: string;
  createdAt: Date;
  status: string;
  approveUrl: string;
  rejectUrl?: string;
}

export class ApprovalsInboxService {
  async getConsolidatedApprovals(
    context: RequestContext,
    filterType?: string
  ) {
    const tenantOId = new mongoose.Types.ObjectId(context.tenantId);

    const [pendingRuns, pendingLoans, pendingReimbs, pendingArrears, pendingAdjustments] =
      await Promise.all([
        // 1. Pending Payroll Runs (GENERATED / DRAFT)
        (!filterType || filterType === "PAYROLL_RUN")
          ? PayrollRunModel.find({
              tenantId: tenantOId,
              status: { $in: [PayrollRunStatus.GENERATED, PayrollRunStatus.DRAFT] },
            })
              .populate("branchId", "name")
              .populate("createdBy", "name email")
              .sort({ createdAt: -1 })
              .lean()
          : [],

        // 2. Pending Loans
        (!filterType || filterType === "LOAN")
          ? LoanModel.find({
              tenantId: tenantOId,
              status: LoanStatus.PENDING,
              isDeleted: false,
            })
              .populate("employeeId", "firstName lastName employeeCode")
              .sort({ createdAt: -1 })
              .lean()
          : [],

        // 3. Pending Reimbursements
        (!filterType || filterType === "REIMBURSEMENT")
          ? ReimbursementModel.find({
              tenantId: tenantOId,
              status: ReimbursementStatus.PENDING,
              isDeleted: false,
            })
              .populate("employeeId", "firstName lastName employeeCode")
              .sort({ createdAt: -1 })
              .lean()
          : [],

        // 4. Pending Arrears Batches
        (!filterType || filterType === "ARREARS_BATCH")
          ? ArrearsBatchModel.find({
              tenantId: tenantOId,
              status: ArrearsBatchStatus.DRAFT,
              isDeleted: false,
            })
              .populate("createdBy", "name email")
              .sort({ createdAt: -1 })
              .lean()
          : [],

        // 5. Pending Individual Adjustments
        (!filterType || filterType === "ADJUSTMENT")
          ? PayrollAdjustmentModel.find({
              tenantId: tenantOId,
              status: AdjustmentStatus.PENDING,
              isDeleted: false,
            })
              .populate("employeeId", "firstName lastName employeeCode")
              .sort({ createdAt: -1 })
              .lean()
          : [],
      ]);

    const items: ApprovalItem[] = [];

    // Map Payroll Runs
    for (const run of pendingRuns as any[]) {
      items.push({
        type: "PAYROLL_RUN",
        refId: run._id.toString(),
        label: `${run.runLabel || "Monthly Payroll Run"} (${(run.branchId as any)?.name || "All Branches"})`,
        detail: `Status: ${run.status} • Total Gross: ₹${(run.totalGross || 0).toLocaleString()}`,
        amount: run.totalNet || run.totalGross || 0,
        requestedBy: (run.createdBy as any)?.name || "HR Admin",
        createdAt: run.createdAt,
        status: run.status,
        approveUrl: `/api/v1/payroll/runs/${run._id}/approve`,
      });
    }

    // Map Loans
    for (const loan of pendingLoans as any[]) {
      const emp = loan.employeeId as any;
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee";
      items.push({
        type: "LOAN",
        refId: loan._id.toString(),
        label: `${loan.type.replace(/_/g, " ")} (${loan.loanReferenceNo})`,
        detail: `${empName} (${emp?.employeeCode || ""}) • ₹${loan.monthlyEmi}/mo for ${loan.tenureMonths} months`,
        amount: loan.principalAmount,
        requestedBy: empName,
        createdAt: loan.createdAt,
        status: loan.status,
        approveUrl: `/api/v1/payroll/loans/${loan._id}/approve`,
        rejectUrl: `/api/v1/payroll/loans/${loan._id}/reject`,
      });
    }

    // Map Reimbursements
    for (const reimb of pendingReimbs as any[]) {
      const emp = reimb.employeeId as any;
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee";
      items.push({
        type: "REIMBURSEMENT",
        refId: reimb._id.toString(),
        label: `${reimb.title} (${reimb.claimNumber})`,
        detail: `${empName} (${emp?.employeeCode || ""}) • Category: ${reimb.category}`,
        amount: reimb.amount,
        requestedBy: empName,
        createdAt: reimb.createdAt,
        status: reimb.status,
        approveUrl: `/api/v1/payroll/reimbursements/${reimb._id}/approve`,
        rejectUrl: `/api/v1/payroll/reimbursements/${reimb._id}/reject`,
      });
    }

    // Map Arrears Batches
    for (const batch of pendingArrears as any[]) {
      items.push({
        type: "ARREARS_BATCH",
        refId: batch._id.toString(),
        label: `${batch.batchName} (${batch.batchNumber})`,
        detail: `${batch.totalEmployees} Employees • Total: ₹${batch.totalAmount.toLocaleString()} • Reason: ${batch.reason}`,
        amount: batch.totalAmount,
        requestedBy: (batch.createdBy as any)?.name || "HR Admin",
        createdAt: batch.createdAt,
        status: batch.status,
        approveUrl: `/api/v1/payroll/arrears/batches/${batch._id}/process`,
      });
    }

    // Map Adjustments
    for (const adj of pendingAdjustments as any[]) {
      const emp = adj.employeeId as any;
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee";
      items.push({
        type: "ADJUSTMENT",
        refId: adj._id.toString(),
        label: `${adj.customLabel || adj.category} (${adj.type})`,
        detail: `${empName} (${emp?.employeeCode || ""}) • ${adj.month}/${adj.year}`,
        amount: adj.amount,
        requestedBy: empName,
        createdAt: adj.createdAt,
        status: adj.status,
        approveUrl: `/api/v1/payroll/adjustments/${adj._id}/approve`,
        rejectUrl: `/api/v1/payroll/adjustments/${adj._id}/reject`,
      });
    }

    // Sort by latest createdAt first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      summary: {
        totalPending: items.length,
        payrollRunsCount: pendingRuns.length,
        loansCount: pendingLoans.length,
        reimbursementsCount: pendingReimbs.length,
        arrearsBatchesCount: pendingArrears.length,
        adjustmentsCount: pendingAdjustments.length,
      },
      approvals: items,
    };
  }
}
