import mongoose from "mongoose";
import { LoanModel, LoanDocument, LoanStatus, LoanType, DisbursementMethod } from "../models/loan.model";
import { EmployeeModel } from "../../employee/models/employee.model";
import { UserModel } from "../../user/user.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import {
  CreateLoanInput,
  UpdateLoanInput,
  ApproveLoanInput,
  RejectLoanInput,
  ListLoansQueryInput,
} from "../dto/loan.dto";

export class LoanService {
  /**
   * Calculate EMI and Total Repayable Amount
   */
  private calculateLoanFinancials(
    principal: number,
    annualInterestRatePercent: number,
    tenureMonths: number,
    customEmi?: number
  ) {
    if (annualInterestRatePercent === 0) {
      const emi = customEmi ?? Math.round((principal / tenureMonths) * 100) / 100;
      return {
        totalRepayable: principal,
        monthlyEmi: emi,
      };
    }

    // Flat rate calculation: Total Interest = Principal * (Rate / 100) * (tenureMonths / 12)
    const totalInterest = principal * (annualInterestRatePercent / 100) * (tenureMonths / 12);
    const totalRepayable = Math.round((principal + totalInterest) * 100) / 100;
    const monthlyEmi = customEmi ?? Math.round((totalRepayable / tenureMonths) * 100) / 100;

    return {
      totalRepayable,
      monthlyEmi,
    };
  }

  /**
   * Generate sequential reference number
   */
  private async generateLoanReference(tenantId: string): Promise<string> {
    const datePrefix = new Date().toISOString().slice(0, 7).replace("-", ""); // e.g. 202608
    const count = await LoanModel.countDocuments({ tenantId });
    const suffix = String(count + 1).padStart(4, "0");
    return `LN-${datePrefix}-${suffix}`;
  }

  /**
   * Create or request a loan
   */
  async createLoan(context: RequestContext, input: CreateLoanInput): Promise<LoanDocument> {
    let targetEmployeeId = input.employeeId;

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

    const interestRate = input.interestRateAnnualPercent ?? 0;
    const { totalRepayable, monthlyEmi } = this.calculateLoanFinancials(
      input.principalAmount,
      interestRate,
      input.tenureMonths,
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

    const isAutoApproveAdmin =
      ["SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"].includes(context.role) &&
      input.employeeId !== undefined;

    const loan = await LoanModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employee._id,
      loanType: input.loanType ?? LoanType.SALARY_ADVANCE,
      loanReferenceNo: referenceNo,
      principalAmount: input.principalAmount,
      interestRateAnnualPercent: interestRate,
      tenureMonths: input.tenureMonths,
      monthlyEmi,
      totalRepayableAmount: totalRepayable,
      totalPaidAmount: 0,
      remainingBalance: totalRepayable,
      disbursementMethod: input.disbursementMethod ?? DisbursementMethod.BANK_TRANSFER,
      disbursementDate: input.disbursementDate ? new Date(input.disbursementDate) : now,
      repaymentStartYear: startYear,
      repaymentStartMonth: startMonth,
      status: isAutoApproveAdmin ? LoanStatus.ACTIVE : LoanStatus.PENDING,
      reason: input.reason,
      approvedBy: isAutoApproveAdmin ? new mongoose.Types.ObjectId(context.userId) : undefined,
      approvedAt: isAutoApproveAdmin ? now : undefined,
      repaymentHistory: [],
    });

    return loan;
  }

  /**
   * List and filter loans
   */
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

  /**
   * Get single loan by ID
   */
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

    return loan;
  }

  /**
   * Get employee self-service active loans
   */
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

  /**
   * Approve a loan
   */
  async approveLoan(context: RequestContext, id: string, input: ApproveLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) {
      throw new AppError("Loan record not found", 404);
    }

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

    if (input.customMonthlyEmi) {
      loan.monthlyEmi = input.customMonthlyEmi;
    }

    await loan.save();
    return loan;
  }

  /**
   * Reject a loan
   */
  async rejectLoan(context: RequestContext, id: string, input: RejectLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) {
      throw new AppError("Loan record not found", 404);
    }

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

  /**
   * Update loan (adjust EMI, pause, resume, or cancel)
   */
  async updateLoan(context: RequestContext, id: string, input: UpdateLoanInput): Promise<LoanDocument> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!loan) {
      throw new AppError("Loan record not found", 404);
    }

    if (input.monthlyEmi) loan.monthlyEmi = input.monthlyEmi;
    if (input.status) loan.status = input.status as LoanStatus;
    if (input.reason) loan.reason = input.reason;
    if (input.approverNotes) loan.approverNotes = input.approverNotes;

    await loan.save();
    return loan;
  }

  /**
   * Delete / Cancel loan
   */
  async deleteLoan(context: RequestContext, id: string): Promise<void> {
    const loan = await LoanModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    });

    if (!loan) {
      throw new AppError("Loan record not found", 404);
    }

    if (loan.status === LoanStatus.ACTIVE && loan.totalPaidAmount > 0) {
      throw new AppError("Cannot delete an active loan with existing repayment records. Set status to PAUSED or CANCELLED instead.", 400);
    }

    loan.isDeleted = true;
    loan.status = LoanStatus.CANCELLED;
    await loan.save();
  }

  /**
   * Get active loan deductions for a specific payroll cycle (Year & Month)
   */
  async getActiveLoansForPayrollCycle(tenantId: string, year: number, month: number) {
    const loans = await LoanModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: LoanStatus.ACTIVE,
      isDeleted: false,
      remainingBalance: { $gt: 0 },
      $or: [
        { repaymentStartYear: { $lt: year } },
        { repaymentStartYear: year, repaymentStartMonth: { $lte: month } },
      ],
    });

    return loans;
  }

  /**
   * Record EMI repayment from a finalized payslip
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
      principalComponent: actualDeduction,
      interestComponent: 0,
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
