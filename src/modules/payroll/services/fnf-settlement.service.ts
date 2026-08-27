import mongoose from "mongoose";
import {
  FnFSettlementModel,
  IFnFSettlement,
  FnFStatus,
  LeavingReason,
} from "../models/fnf-settlement.model";
import { EmployeeModel, EmployeeStatus } from "../../employee/models/employee.model";
import { SalaryStructureModel } from "../models/salary-structure.model";
import { LoanModel, LoanStatus } from "../models/loan.model";
import { ReimbursementModel, ReimbursementStatus } from "../models/reimbursement.model";
import { LeaveBalanceModel } from "../../leave/sub-modules/leave-balances/leave-balance.model";
import { CounterModel } from "../../employee/utils/employee-counter.util";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import {
  ComputeFnFInput,
  ProcessFnFInput,
  FnFQueryInput,
} from "../dto/fnf-settlement.dto";

export class FnFSettlementService {
  /**
   * Generate atomic settlement number: FNF-YYYYMM-0001
   */
  private async generateSettlementNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sequenceKey = `fnf_settlement_${yearMonth}`;

    const counter = await CounterModel.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId), sequenceName: sequenceKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

    const seq = String(counter.seq).padStart(4, "0");
    return `FNF-${yearMonth}-${seq}`;
  }

  /**
   * Compute Full & Final Settlement breakdown without modifying database
   */
  async computeSettlement(
    context: RequestContext,
    employeeId: string,
    input: ComputeFnFInput
  ) {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new AppError("Invalid employee ID format", 400);
    }

    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(employeeId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!employee) {
      throw new AppError("Employee not found in this organization", 404);
    }

    const lastWorkingDate = new Date(input.lastWorkingDay);
    const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : lastWorkingDate;

    // 1. Calculate tenure in years (e.g. 5.2 years)
    const diffMs = lastWorkingDate.getTime() - joiningDate.getTime();
    const tenureYears = Math.max(0, Math.round((diffMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10);

    // 2. Fetch active salary structure for basic & gross
    const structure = await SalaryStructureModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isActive: true,
      isDeleted: false,
    }).lean();

    const lastDrawnGross = structure?.grossMonthly ?? 0;
    const basicLine = structure?.lineItems?.find((l) => l.componentCode === "BASIC");
    const lastDrawnBasic = basicLine?.amount ?? Math.round(lastDrawnGross * 0.5);

    // 3. Unpaid salary calculation for exit month up to lastWorkingDay
    const exitDay = lastWorkingDate.getDate();
    const totalDaysInMonth = new Date(lastWorkingDate.getFullYear(), lastWorkingDate.getMonth() + 1, 0).getDate();
    const unpaidSalaryDays = exitDay;
    const unpaidSalaryAmount = totalDaysInMonth > 0 ? Math.round((lastDrawnGross / totalDaysInMonth) * unpaidSalaryDays) : 0;

    // 4. Leave encashment calculation (Earned / Paid leaves balance)
    let leaveEncashmentDays = 0;
    const balances = await LeaveBalanceModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
    }).lean();

    for (const bal of balances) {
      if ((bal as any).closingBalance > 0) {
        leaveEncashmentDays += (bal as any).closingBalance;
      }
    }
    const leaveEncashmentAmount = Math.round((lastDrawnBasic / 30) * leaveEncashmentDays);

    // 5. Gratuity calculation (Eligible if tenure >= 5.0 years)
    // Formula: (15 * Last Drawn Basic * Tenure Years) / 26
    let gratuityAmount = 0;
    if (tenureYears >= 5) {
      gratuityAmount = Math.round((15 * lastDrawnBasic * Math.round(tenureYears)) / 26);
    }

    // 6. Notice period recovery
    const noticePeriodDays = input.noticePeriodDays ?? 30;
    const noticeServedDays = input.noticeServedDays ?? noticePeriodDays;
    const shortfallNoticeDays = Math.max(0, noticePeriodDays - noticeServedDays);
    const noticeRecoveryAmount = shortfallNoticeDays > 0 ? Math.round((lastDrawnGross / 30) * shortfallNoticeDays) : 0;

    // 7. Active loan / salary advance recovery
    let loanBalanceRecovery = 0;
    const activeLoans = await LoanModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: LoanStatus.ACTIVE,
      isDeleted: false,
    }).lean();

    for (const loan of activeLoans) {
      loanBalanceRecovery += loan.remainingBalance;
    }

    // 8. Pending approved reimbursements
    let reimbursementAmount = 0;
    const pendingReimbs = await ReimbursementModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: ReimbursementStatus.APPROVED,
      isDeleted: false,
    }).lean();

    for (const r of pendingReimbs) {
      reimbursementAmount += (r.approvedAmount ?? r.amount);
    }

    // 9. Statutory deductions estimate on unpaid salary (e.g. PF ~12% on Basic, PT ~₹200)
    const proRatedBasic = Math.round((lastDrawnBasic / totalDaysInMonth) * unpaidSalaryDays);
    const pfDeduction = proRatedBasic > 0 ? Math.round(Math.min(proRatedBasic * 0.12, 1800)) : 0;
    const ptDeduction = unpaidSalaryAmount > 10000 ? 200 : 0;
    const statutoryDeductions = pfDeduction + ptDeduction;

    // 10. Totals
    const bonusAmount = input.bonusAmount || 0;
    const otherEarnings = input.otherEarnings || 0;
    const assetDamageRecovery = input.assetDamageRecovery || 0;
    const otherDeductions = input.otherDeductions || 0;

    const totalEarnings =
      unpaidSalaryAmount +
      leaveEncashmentAmount +
      gratuityAmount +
      bonusAmount +
      reimbursementAmount +
      otherEarnings;

    const totalDeductions =
      noticeRecoveryAmount +
      loanBalanceRecovery +
      statutoryDeductions +
      assetDamageRecovery +
      otherDeductions;

    const netSettlement = Math.max(0, totalEarnings - totalDeductions);

    return {
      employee: {
        _id: employee._id,
        employeeCode: employee.employeeCode,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        joiningDate: employee.joiningDate,
        lastWorkingDay: input.lastWorkingDay,
        tenureYears,
      },
      lastDrawnGross,
      lastDrawnBasic,
      earnings: {
        unpaidSalaryDays,
        unpaidSalaryAmount,
        leaveEncashmentDays,
        leaveEncashmentAmount,
        gratuityAmount,
        bonusAmount,
        reimbursementAmount,
        otherEarnings,
        totalEarnings,
      },
      deductions: {
        noticePeriodDays,
        noticeServedDays,
        shortfallNoticeDays,
        noticeRecoveryAmount,
        loanBalanceRecovery,
        statutoryDeductions,
        assetDamageRecovery,
        otherDeductions,
        totalDeductions,
      },
      netSettlement,
    };
  }

  /**
   * Process & Finalize Full & Final Settlement
   */
  async processSettlement(
    context: RequestContext,
    employeeId: string,
    input: ProcessFnFInput
  ): Promise<IFnFSettlement> {
    const computed = await this.computeSettlement(context, employeeId, input);

    const settlementNumber = await this.generateSettlementNumber(context.tenantId);

    const settlement = await FnFSettlementModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      settlementNumber,
      resignationDate: input.resignationDate ? new Date(input.resignationDate) : undefined,
      lastWorkingDay: new Date(input.lastWorkingDay),
      leavingReason: input.leavingReason || LeavingReason.RESIGNED,
      tenureYears: computed.employee.tenureYears,

      noticePeriodDays: computed.deductions.noticePeriodDays,
      noticeServedDays: computed.deductions.noticeServedDays,
      shortfallNoticeDays: computed.deductions.shortfallNoticeDays,

      lastDrawnGross: computed.lastDrawnGross,
      lastDrawnBasic: computed.lastDrawnBasic,
      unpaidSalaryDays: computed.earnings.unpaidSalaryDays,
      unpaidSalaryAmount: computed.earnings.unpaidSalaryAmount,
      leaveEncashmentDays: computed.earnings.leaveEncashmentDays,
      leaveEncashmentAmount: computed.earnings.leaveEncashmentAmount,
      gratuityAmount: computed.earnings.gratuityAmount,
      bonusAmount: computed.earnings.bonusAmount,
      reimbursementAmount: computed.earnings.reimbursementAmount,
      otherEarnings: computed.earnings.otherEarnings,
      totalEarnings: computed.earnings.totalEarnings,

      noticeRecoveryAmount: computed.deductions.noticeRecoveryAmount,
      loanBalanceRecovery: computed.deductions.loanBalanceRecovery,
      statutoryDeductions: computed.deductions.statutoryDeductions,
      assetDamageRecovery: computed.deductions.assetDamageRecovery,
      otherDeductions: computed.deductions.otherDeductions,
      totalDeductions: computed.deductions.totalDeductions,

      netSettlement: computed.netSettlement,
      status: FnFStatus.PROCESSED,
      approvalNotes: input.approvalNotes?.trim(),
      approvedBy: new mongoose.Types.ObjectId(context.userId),
      approvedAt: new Date(),
      processedBy: new mongoose.Types.ObjectId(context.userId),
      processedAt: new Date(),
    });

    // Update Employee Status to RESIGNED / TERMINATED
    const targetStatus =
      input.leavingReason === LeavingReason.TERMINATED
        ? EmployeeStatus.TERMINATED
        : EmployeeStatus.RESIGNED;

    await EmployeeModel.findByIdAndUpdate(employeeId, {
      status: targetStatus,
      isActive: false,
    });

    // Mark outstanding loans as settled/closed
    await LoanModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        status: LoanStatus.ACTIVE,
      },
      {
        status: LoanStatus.COMPLETED,
        remainingBalance: 0,
      }
    );

    return settlement;
  }

  /**
   * List FnF settlements
   */
  async listSettlements(context: RequestContext, query: FnFQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.employeeId && mongoose.Types.ObjectId.isValid(query.employeeId)) {
      filter.employeeId = new mongoose.Types.ObjectId(query.employeeId);
    }

    const [settlements, totalRecords] = await Promise.all([
      FnFSettlementModel.find(filter)
        .populate("employeeId", "firstName lastName employeeCode avatarUrl departmentId designationId")
        .populate("approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FnFSettlementModel.countDocuments(filter),
    ]);

    return {
      data: settlements,
      totalRecords,
      pageNumber: page,
      pageSize: limit,
    };
  }

  /**
   * Get single settlement by ID
   */
  async getSettlementById(context: RequestContext, id: string): Promise<IFnFSettlement> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid FnF settlement ID format", 400);
    }

    const settlement = await FnFSettlementModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    })
      .populate("employeeId", "firstName lastName employeeCode avatarUrl departmentId designationId joiningDate")
      .populate("approvedBy", "name email")
      .populate("processedBy", "name email");

    if (!settlement) {
      throw new AppError("FnF settlement not found", 404);
    }

    return settlement;
  }
}
