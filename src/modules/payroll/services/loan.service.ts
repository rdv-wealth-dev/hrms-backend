import mongoose from "mongoose";
import { LoanModel, LoanDocument, LoanStatus, LoanType, DisbursementMethod } from "../models/loan.model";
import { InterestMethod } from "../models/loan-policy-config.model";
import { EmployeeModel } from "../../employee/models/employee.model";
import { UserModel } from "../../user/user.model";
import { CounterModel } from "../../employee/utils/employee-counter.util";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import {
  CreateLoanInput,
  UpdateLoanInput,
  ApproveLoanInput,
  RejectLoanInput,
  ListLoansQueryInput,
} from "../dto/loan.dto";
import { LoanPolicyConfigService } from "./loan-policy-config.service";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROLES — used for ownership guards throughout this service
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"];

export class LoanService {
  private policyService = new LoanPolicyConfigService();

  // ─────────────────────────────────────────────────────────────────────────
  // FINANCIAL CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate EMI and total repayable amount.
   *
   * FLAT:              Total interest = P × (r/100) × (n/12)
   *                    EMI = totalRepayable / n
   *
   * REDUCING_BALANCE:  Monthly rate = annualRate / (12 × 100)
   *                    EMI = P × mr × (1+mr)^n / ((1+mr)^n − 1)
   *                    (Standard reducing-balance formula per RBI/banking convention)
   */
  calculateLoanFinancials(
    principal: number,
    annualInterestRatePercent: number,
    tenureMonths: number,
    method: InterestMethod = InterestMethod.FLAT,
    customEmi?: number
  ): { totalRepayable: number; monthlyEmi: number } {
    if (annualInterestRatePercent === 0 || tenureMonths === 0) {
      const emi = customEmi ?? Math.round((principal / tenureMonths) * 100) / 100;
      return { totalRepayable: principal, monthlyEmi: emi };
    }

    if (method === InterestMethod.REDUCING_BALANCE) {
      const monthlyRate = annualInterestRatePercent / (12 * 100);
      const factor = Math.pow(1 + monthlyRate, tenureMonths);
      const emi = customEmi ?? Math.round((principal * monthlyRate * factor) / (factor - 1) * 100) / 100;
      const totalRepayable = Math.round(emi * tenureMonths * 100) / 100;
      return { totalRepayable, monthlyEmi: emi };
    }

    // FLAT
    const totalInterest = principal * (annualInterestRatePercent / 100) * (tenureMonths / 12);
    const totalRepayable = Math.round((principal + totalInterest) * 100) / 100;
    const monthlyEmi = customEmi ?? Math.round((totalRepayable / tenureMonths) * 100) / 100;
    return { totalRepayable, monthlyEmi };
  }

  /**
   * Compute principal & interest split for a single EMI payment.
   * For FLAT loans both components are pre-determined at origination,
   * so we allocate proportionally. For REDUCING_BALANCE we track the
   * actual outstanding balance.
   */
  private computeEmiSplit(
    emiAmount: number,
    outstandingPrincipal: number,
    annualInterestRatePercent: number,
    method: InterestMethod
  ): { principalComponent: number; interestComponent: number } {
    if (annualInterestRatePercent === 0 || method === InterestMethod.FLAT) {
      return { principalComponent: emiAmount, interestComponent: 0 };
    }
    // Reducing balance: interest = outstandingPrincipal × monthlyRate
    const monthlyRate = annualInterestRatePercent / (12 * 100);
    const interestComponent = Math.round(outstandingPrincipal * monthlyRate * 100) / 100;
    const principalComponent = Math.round((emiAmount - interestComponent) * 100) / 100;
    return { principalComponent, interestComponent };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFERENCE GENERATION — atomic, race-condition-free
  // ─────────────────────────────────────────────────────────────────────────

  private async generateLoanReference(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`; // e.g. 202608
    const sequenceKey = `loan_${yearMonth}`;

    const counter = await CounterModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId), sequenceName: sequenceKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

    const suffix = String(counter.seq).padStart(4, "0");
    return `LN-${yearMonth}-${suffix}`; // e.g. LN-202608-0001
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE LOAN
  // ─────────────────────────────────────────────────────────────────────────

  async createLoan(context: RequestContext, input: CreateLoanInput): Promise<LoanDocument> {
    let targetEmployeeId = input.employeeId;
    const isEmployeeSelfApply = !targetEmployeeId;

    // If employee self-requests, resolve employeeId from context
    if (!targetEmployeeId) {
      const user = await UserModel.findById(context.userId);
      if (!user?.employeeId) {
        throw new AppError("No employee profile found for current user", 400);
      }
      targetEmployeeId = user.employeeId.toString();
    }

    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(targetEmployeeId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!employee) {
      throw new AppError("Employee not found in this organization", 404);
    }

    // ── Policy validation ───────────────────────────────────────────────────
    const loanType = (input.loanType as LoanType) ?? LoanType.SALARY_ADVANCE;
    await this.policyService.validateLoanAgainstPolicy(context, targetEmployeeId, {
      loanType,
      principalAmount: input.principalAmount,
      tenureMonths: input.tenureMonths,
      isEmployeeSelfApply,
    });

    // ── Resolve interest method ─────────────────────────────────────────────
    // Per-loan override > tenant policy default
    const policy = await this.policyService.getPolicy(context.tenantId);
    const interestMethod = (input.interestMethod as InterestMethod | undefined)
      ?? (policy as any).defaultInterestMethod
      ?? InterestMethod.FLAT;

    const interestRate = input.interestRateAnnualPercent ?? 0;
    const { totalRepayable, monthlyEmi } = this.calculateLoanFinancials(
      input.principalAmount,
      interestRate,
      input.tenureMonths,
      interestMethod,
      input.monthlyEmi
    );

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Repayment starts next month by default if not specified
    let startYear = input.repaymentStartYear ?? currentYear;
    let startMonth = input.repaymentStartMonth ?? (currentMonth === 12 ? 1 : currentMonth + 1);
    if (!input.repaymentStartYear && currentMonth === 12) {
      startYear += 1;
    }

    const referenceNo = await this.generateLoanReference(context.tenantId);

    const isAdmin = ADMIN_ROLES.includes(context.role);
    const isAutoApprove =
      isAdmin && !isEmployeeSelfApply && (policy as any).adminCreatedLoansAutoApprove !== false;

    const loan = await LoanModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employee._id,
      loanType,
      loanReferenceNo: referenceNo,
      principalAmount: input.principalAmount,
      interestRateAnnualPercent: interestRate,
      interestMethod,
      tenureMonths: input.tenureMonths,
      monthlyEmi,
      totalRepayableAmount: totalRepayable,
      totalPaidAmount: 0,
      remainingBalance: totalRepayable,
      disbursementMethod: input.disbursementMethod ?? DisbursementMethod.BANK_TRANSFER,
      disbursementDate: input.disbursementDate ? new Date(input.disbursementDate) : now,
      repaymentStartYear: startYear,
      repaymentStartMonth: startMonth,
      status: isAutoApprove ? LoanStatus.ACTIVE : LoanStatus.PENDING,
      reason: input.reason,
      approvedBy: isAutoApprove ? new mongoose.Types.ObjectId(context.userId) : undefined,
      approvedAt: isAutoApprove ? now : undefined,
      repaymentHistory: [],
    });

    return loan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST LOANS
  // ─────────────────────────────────────────────────────────────────────────

  async listLoans(context: RequestContext, query: ListLoansQueryInput) {
    const page = query.page ?? query.pageNumber ?? 1;
    const limit = query.limit ?? query.pageSize ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    if (query.employeeId) {
      filter.employeeId = new mongoose.Types.ObjectId(query.employeeId);
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.loanType) {
      filter.loanType = query.loanType;
    }

    const [loans, totalRecords] = await Promise.all([
      LoanModel.find(filter)
        .populate("employeeId", "employeeCode firstName lastName email phone departmentId designationId branchId")
        .populate("approvedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanModel.countDocuments(filter),
    ]);

    return {
      data: loans,
      totalRecords,
      pageNumber: page,
      pageSize: limit,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET LOAN BY ID — with ownership guard
  // Admin roles (SUPER_ADMIN, ORG_ADMIN, HR_ADMIN, HR_MANAGER) can view any loan.
  // Employees can only view their own loans — 403 for any other loan.
  // ─────────────────────────────────────────────────────────────────────────

  async getLoanById(context: RequestContext, id: string): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("employeeId", "employeeCode firstName lastName email departmentId designationId branchId")
      .populate("approvedBy", "firstName lastName email");

    if (!loan) {
      throw new AppError("Loan record not found", 404);
    }

    // ── Ownership guard ───────────────────────────────────────────────────
    const isAdmin = ADMIN_ROLES.includes(context.role);
    if (!isAdmin) {
      const loanOwnerEmpId = loan.employeeId.toString();
      const callerEmpId = context.employeeId;
      if (!callerEmpId || loanOwnerEmpId !== callerEmpId) {
        throw new AppError("Access denied — you can only view your own loan records", 403);
      }
    }

    return loan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET MY LOANS — employee self-service
  // ─────────────────────────────────────────────────────────────────────────

  async getMyLoans(context: RequestContext) {
    const user = await UserModel.findById(context.userId);
    if (!user?.employeeId) {
      return { data: [], totalRecords: 0 };
    }

    const loans = await LoanModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: user.employeeId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return {
      data: loans,
      totalRecords: loans.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AMORTIZATION SCHEDULE
  // Returns month-by-month repayment table — principal, interest, balance.
  // ─────────────────────────────────────────────────────────────────────────

  async getLoanSchedule(context: RequestContext, id: string) {
    const loan = await this.getLoanById(context, id); // also applies ownership guard

    const schedule: {
      instalmentNo: number;
      year: number;
      month: number;
      openingBalance: number;
      emi: number;
      principalComponent: number;
      interestComponent: number;
      closingBalance: number;
      paid: boolean;
    }[] = [];

    const method = (loan as any).interestMethod ?? InterestMethod.FLAT;
    let balance = loan.totalRepayableAmount;
    let year = loan.repaymentStartYear;
    let month = loan.repaymentStartMonth;

    for (let i = 1; i <= loan.tenureMonths; i++) {
      const openingBalance = Math.round(balance * 100) / 100;
      const emi = Math.min(loan.monthlyEmi, openingBalance);

      const { principalComponent, interestComponent } = this.computeEmiSplit(
        emi,
        // For reducing balance, opening principal matters — approximate with opening balance
        loan.principalAmount * (openingBalance / loan.totalRepayableAmount),
        loan.interestRateAnnualPercent,
        method
      );

      balance -= emi;
      const closingBalance = Math.round(Math.max(0, balance) * 100) / 100;

      // Check if this instalment has been paid in repaymentHistory
      const historyEntry = loan.repaymentHistory?.find(
        (h: any) => h.year === year && h.month === month
      );

      schedule.push({
        instalmentNo: i,
        year,
        month,
        openingBalance,
        emi: Math.round(emi * 100) / 100,
        principalComponent: Math.round(principalComponent * 100) / 100,
        interestComponent: Math.round(interestComponent * 100) / 100,
        closingBalance,
        paid: !!historyEntry,
      });

      // Advance to next month
      if (month === 12) { month = 1; year++; }
      else { month++; }
    }

    return {
      loanReferenceNo: loan.loanReferenceNo,
      principalAmount: loan.principalAmount,
      totalRepayableAmount: loan.totalRepayableAmount,
      totalPaidAmount: loan.totalPaidAmount,
      remainingBalance: loan.remainingBalance,
      monthlyEmi: loan.monthlyEmi,
      interestMethod: method,
      status: loan.status,
      schedule,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APPROVE
  // ─────────────────────────────────────────────────────────────────────────

  async approveLoan(context: RequestContext, id: string, input: ApproveLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) throw new AppError("Loan record not found", 404);
    if (loan.status !== LoanStatus.PENDING) {
      throw new AppError(`Cannot approve loan in '${loan.status}' status`, 400);
    }

    const now = new Date();
    loan.status = LoanStatus.ACTIVE;
    loan.approvedBy = new mongoose.Types.ObjectId(context.userId);
    loan.approvedAt = now;

    if (input.approverNotes) loan.approverNotes = input.approverNotes;
    if (input.disbursementMethod) loan.disbursementMethod = input.disbursementMethod as DisbursementMethod;
    if (input.disbursementDate) loan.disbursementDate = new Date(input.disbursementDate);
    if (input.repaymentStartYear) loan.repaymentStartYear = input.repaymentStartYear;
    if (input.repaymentStartMonth) loan.repaymentStartMonth = input.repaymentStartMonth;
    if (input.customMonthlyEmi) loan.monthlyEmi = input.customMonthlyEmi;

    await loan.save();
    return loan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REJECT
  // ─────────────────────────────────────────────────────────────────────────

  async rejectLoan(context: RequestContext, id: string, input: RejectLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) throw new AppError("Loan record not found", 404);
    if (loan.status !== LoanStatus.PENDING) {
      throw new AppError(`Cannot reject loan in '${loan.status}' status`, 400);
    }

    loan.status = LoanStatus.REJECTED;
    loan.rejectionReason = input.reason;
    loan.rejectedBy = new mongoose.Types.ObjectId(context.userId);
    loan.rejectedAt = new Date();

    await loan.save();
    return loan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async updateLoan(context: RequestContext, id: string, input: UpdateLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) throw new AppError("Loan record not found", 404);

    if (input.monthlyEmi) loan.monthlyEmi = input.monthlyEmi;
    if (input.status) loan.status = input.status as LoanStatus;
    if (input.reason) loan.reason = input.reason;
    if (input.approverNotes) loan.approverNotes = input.approverNotes;

    await loan.save();
    return loan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  async deleteLoan(context: RequestContext, id: string): Promise<void> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    });

    if (!loan) throw new AppError("Loan record not found", 404);

    if (loan.status === LoanStatus.ACTIVE && loan.totalPaidAmount > 0) {
      throw new AppError(
        "Cannot delete an active loan with existing repayment records. Set status to PAUSED or CANCELLED instead.",
        400
      );
    }

    loan.isDeleted = true;
    loan.status = LoanStatus.CANCELLED;
    await loan.save();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAYROLL ENGINE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get active loan deductions for a specific payroll cycle (Year & Month).
   */
  async getActiveLoansForPayrollCycle(tenantId: string, year: number, month: number) {
    return LoanModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: LoanStatus.ACTIVE,
      isDeleted: false,
      remainingBalance: { $gt: 0 },
      $or: [
        { repaymentStartYear: { $lt: year } },
        { repaymentStartYear: year, repaymentStartMonth: { $lte: month } },
      ],
    });
  }

  /**
   * Record EMI repayment from a finalized payslip.
   * Calculates correct principal/interest split based on interest method.
   */
  async recordEmiRepayment(
    tenantId: string,
    loanId: string,
    year: number,
    month: number,
    amount: number,
    payrollRunId?: string,
    payslipId?: string
  ): Promise<LoanDocument | null> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(loanId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!loan) return null;

    const actualDeduction = Math.min(amount, loan.remainingBalance);
    const method = (loan as any).interestMethod ?? InterestMethod.FLAT;

    const { principalComponent, interestComponent } = this.computeEmiSplit(
      actualDeduction,
      loan.remainingBalance,
      loan.interestRateAnnualPercent,
      method
    );

    const newPaid = Math.round((loan.totalPaidAmount + actualDeduction) * 100) / 100;
    const newRemaining = Math.max(0, Math.round((loan.totalRepayableAmount - newPaid) * 100) / 100);

    loan.totalPaidAmount = newPaid;
    loan.remainingBalance = newRemaining;

    loan.repaymentHistory.push({
      year,
      month,
      payrollRunId: payrollRunId ? new mongoose.Types.ObjectId(payrollRunId) : undefined,
      payslipId: payslipId ? new mongoose.Types.ObjectId(payslipId) : undefined,
      amountPaid: actualDeduction,
      principalComponent,
      interestComponent,
      balanceAfter: newRemaining,
      paidAt: new Date(),
    });

    if (newRemaining <= 0) {
      loan.status = LoanStatus.COMPLETED;
    }

    await loan.save();
    return loan;
  }
}
