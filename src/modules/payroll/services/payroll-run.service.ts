import mongoose from "mongoose";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayslipRepository } from "../repositories/payslip.repository";
import { SalaryStructureRepository } from "../repositories/salary-structure.repository";
import { SalaryComponentRepository } from "../repositories/salary-component.repository";
import { PayrollRunStatus } from "../models/payroll-run.model";
import { PayslipModel } from "../models/payslip.model";
import { PayrollAdjustmentRepository } from "../repositories/payroll-adjustment.repository";
import { AdjustmentType } from "../models/payroll-adjustment.model";
import { CreatePayrollRunInput, ApprovePayrollRunInput } from "../dto/payroll.dto";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeModel } from "../../employee/models/employee.model";
import { EmployeeBankAccountModel } from "../../employee/models/employee-bank-account.model";
import { OrganizationModel } from "../../organization/organization.model";
import { BranchModel } from "../../branch/branch.model";
import { AttendanceModel } from "../../attendance/models/attendance.model";
import { AttendanceLockModel, AttendanceLockStatus } from "../../attendance/models/attendance-lock.model";
import { ComponentType } from "../models/salary-component.model";
import { PayrollStrategyFactory } from "../strategies";

import {
  assertAttendanceLocked,
  buildAttendanceSummary,
  proRateEarnings,
  calculatePF,
  calculateESI,
  calculatePT,
  calculateLWF,
  calculateTDS,
  getApprovedOTAmount,
  calculateMonthlyGratuityProvision,
  assertPositiveNetPay,
  getFinancialYear,
  getMonthsRemainingInFY,
} from "./payroll-engine.service";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getPrecedingMonthsOfContributionPeriod(year: number, month: number): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  if (month >= 4 && month <= 9) {
    // April to September
    for (let m = 4; m < month; m++) {
      result.push({ year, month: m });
    }
  } else {
    // October to March
    if (month >= 10 && month <= 12) {
      for (let m = 10; m < month; m++) {
        result.push({ year, month: m });
      }
    } else {
      // Month is 1, 2, or 3 (Jan, Feb, Mar)
      // Preceding months from previous calendar year (Oct, Nov, Dec)
      result.push({ year: year - 1, month: 10 });
      result.push({ year: year - 1, month: 11 });
      result.push({ year: year - 1, month: 12 });
      // Preceding months from current calendar year (Jan to month - 1)
      for (let m = 1; m < month; m++) {
        result.push({ year, month: m });
      }
    }
  }
  return result;
}

export class PayrollRunService {
  private runRepo = new PayrollRunRepository();
  private payslipRepo = new PayslipRepository();
  private structureRepo = new SalaryStructureRepository();
  private componentRepo = new SalaryComponentRepository();
  private adjustmentRepo = new PayrollAdjustmentRepository();

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE RUN
  // ─────────────────────────────────────────────────────────────────────────

  async createRun(context: RequestContext, input: CreatePayrollRunInput) {
    const branchId = input.branchId || context.branchIds[0] || "";
    if (!branchId) {
      throw new AppError("branchId is required to create a payroll run", 400);
    }

    const existing = await this.runRepo.findByMonthYear(
      context, branchId, input.year, input.month
    );
    if (existing) {
      throw new AppError(
        `A payroll run for ${MONTH_NAMES[input.month - 1]} ${input.year} already exists for this branch`,
        409
      );
    }

    const branch = await BranchModel.findById(branchId).select("countryCode currency").lean();

    return this.runRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: new mongoose.Types.ObjectId(branchId) as any,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      month: input.month,
      year: input.year,
      countryCode: (branch as any)?.countryCode || "IN",
      currency: (branch as any)?.currency || "INR",
      runLabel: `${MONTH_NAMES[input.month - 1]} ${input.year}`,
      status: PayrollRunStatus.DRAFT,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRE-FLIGHT VALIDATION
  // Surface per-employee errors before calculation starts.
  // HR fixes these before generating payslips.
  // ─────────────────────────────────────────────────────────────────────────

  async validateRun(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    const branchId = (run.branchId as mongoose.Types.ObjectId).toString();
    const period = `${run.year}-${String(run.month).padStart(2, "0")}`;
    const errors: string[] = [];

    // ── Check 1: Attendance must be locked ────────────────────────────────
    const lock = await AttendanceLockModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      period,
    }).lean();

    if (!lock || lock.status !== AttendanceLockStatus.LOCKED) {
      errors.push(
        `CRITICAL: Attendance for ${period} is not locked. ` +
        `Lock attendance before generating payslips.`
      );
    }

    // ── Check 2: Branch check & Country Strategy pre-flight validation ──
    const branch = await BranchModel.findById(branchId)
      .select("address name countryCode currency stateOrRegionCode")
      .lean<{ name: string; countryCode?: string; currency?: string; stateOrRegionCode?: string; address?: { state?: string } }>();

    if (!branch) {
      errors.push(`CRITICAL: Branch not found for this payroll run.`);
    }

    const countryCode = branch?.countryCode || run.countryCode || "IN";
    const strategy = PayrollStrategyFactory.getStrategy(countryCode);

    // ── Check 3: Per-employee validation ──────────────────────────────────
    const employees = await EmployeeModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isActive: true,
      isDeleted: false,
    }).select("_id employeeCode firstName lastName pan").lean();

    const fromDate = new Date(run.year, run.month - 1, 1);
    const toDate = new Date(run.year, run.month, 0, 23, 59, 59);

    for (const emp of employees) {
      const empLabel = `${emp.employeeCode} (${emp.firstName} ${emp.lastName})`;

      // Salary structure assigned?
      const structure = await this.structureRepo.findActiveForEmployee(
        context, (emp._id as mongoose.Types.ObjectId).toString()
      );
      if (!structure) {
        errors.push(`${empLabel}: No active salary structure assigned.`);
        continue;
      }

      // PAN present? Without PAN → flat 20% TDS (Section 206AA)
      if (!emp.pan) {
        errors.push(
          `${empLabel}: PAN not on file — TDS will be deducted at 20% flat rate (Section 206AA).`
        );
      }

      // Bank account present?
      const hasBank = await EmployeeBankAccountModel.exists({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeId: emp._id,
        isActive: true,
      });

      if (!hasBank) {
        errors.push(
          `${empLabel}: WARNING — No active bank account on file for direct disbursement.`
        );
      }

      // Attendance data exists for this period?
      const attCount = await AttendanceModel.countDocuments({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeId: emp._id,
        attendanceDate: { $gte: fromDate, $lte: toDate },
        isDeleted: false,
      });

      if (attCount === 0) {
        errors.push(
          `${empLabel}: No attendance records found for ${period}.`
        );
      }
    }

    // Country Strategy specific pre-flight validations
    if (strategy) {
      const strategyReport = await strategy.validatePreFlightProfiles(employees, branch, period);
      errors.push(...strategyReport.criticalErrors.map(e => `CRITICAL: ${e}`));
      errors.push(...strategyReport.warnings.map(w => `WARNING: ${w}`));
    }

    // Save validation results to the run record
    run.validatedAt = new Date();
    run.validationErrors = errors;
    await this.runRepo.save(run);

    return {
      valid: errors.filter(e => e.startsWith("CRITICAL")).length === 0
        && errors.length === 0,
      totalChecked: employees.length,
      errors,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERATE PAYSLIPS — full 20-step calculation per employee
  // ─────────────────────────────────────────────────────────────────────────

  async generatePayslips(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new AppError(
        `Cannot generate payslips — run status is ${run.status}, expected DRAFT`,
        400
      );
    }

    const branchId = (run.branchId as mongoose.Types.ObjectId).toString();

    // ── HARD STOP: attendance must be locked ──────────────────────────────
    await assertAttendanceLocked(
      context.tenantId, branchId, run.year, run.month
    );

    // ── Load org statutory flags ───────────────────────────────────────────
    const org = await OrganizationModel.findById(context.tenantId)
      .select("statutory")
      .lean();

    const statutory = (org?.statutory ?? {}) as {
      pfEnabled: boolean;
      esiEnabled: boolean;
      ptEnabled: boolean;
      tdsEnabled: boolean;
      lwfEnabled: boolean;
    };

    // ── Load branch details & Country Strategy ───────────────────────────
    const branch = await BranchModel.findById(branchId)
      .select("address name countryCode currency stateOrRegionCode")
      .lean();

    const countryCode = (branch as any)?.countryCode || run.countryCode || "IN";
    const currency = (branch as any)?.currency || run.currency || "INR";
    const stateCode = (branch as any)?.stateOrRegionCode || ((branch as any)?.address?.state ? (branch as any).address.state.toUpperCase() : "");

    const strategy = PayrollStrategyFactory.getStrategy(countryCode);

    const financialYear = getFinancialYear(run.year, run.month);
    const monthsRemaining = getMonthsRemainingInFY(run.month);

    // ── Fetch all active employees for this branch ─────────────────────────
    const employees = await EmployeeModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isActive: true,
      isDeleted: false,
    }).lean();

    run.status = PayrollRunStatus.PROCESSING;
    await this.runRepo.save(run);

    let totalGross = 0, totalDeductions = 0, totalNet = 0, generatedCount = 0;
    const skipped: string[] = [];
    const errored: string[] = [];

    // ── PER-EMPLOYEE LOOP ──────────────────────────────────────────────────
    for (const employee of employees) {
      const empId = (employee._id as mongoose.Types.ObjectId).toString();
      const empLabel = employee.employeeCode;

      try {
        // STEP 1: Load salary structure
        const structure = await this.structureRepo.findActiveForEmployee(
          context, empId
        );
        if (!structure) {
          skipped.push(`${empLabel}: No salary structure`);
          continue;
        }

        // STEP 2: Skip if payslip already exists for this run
        const alreadyExists = await this.payslipRepo.existsForRunAndEmployee(
          context, runId, empId
        );
        if (alreadyExists) continue;

        // STEP 3: Load component definitions
        const componentCodes = structure.lineItems.map(li => li.componentCode);
        const components = await this.componentRepo.findAllByCodes(
          context, componentCodes
        );
        const componentMap = new Map(components.map(c => [c.code, c]));

        const earningItems = structure.lineItems.filter(
          li => componentMap.get(li.componentCode)?.type === ComponentType.EARNING
        );
        const deductionItems = structure.lineItems.filter(
          li => componentMap.get(li.componentCode)?.type === ComponentType.DEDUCTION
        );

        // STEP 4: Build attendance summary (N+1 fixed — bulk queries inside)
        const attendanceSummary = await buildAttendanceSummary(
          context.tenantId, empId, run.year, run.month
        );

        // STEP 5: Pro-rate earnings by payable days
        const earnings = proRateEarnings(
          earningItems,
          attendanceSummary.payableDays,
          attendanceSummary.totalDaysInMonth
        ).map(e => ({
          ...e,
          componentName: componentMap.get(e.componentCode)?.name ?? e.componentCode,
        }));

        let grossEarned = earnings.reduce((sum, e) => sum + e.amount, 0);
        const lopAmount = Math.max(0, structure.grossMonthly - grossEarned);

        // STEP 6: Add approved OT as a named earning line item
        const otAmount = await getApprovedOTAmount(
          context.tenantId, empId, run.year, run.month
        );
        if (otAmount > 0) {
          earnings.push({
            componentCode: "OT",
            componentName: "Overtime Pay",
            amount: Math.round(otAmount * 100) / 100,
          });
          grossEarned += otAmount;
        }

        // STEP 6.5: Fixed deductions from salary structure
        const deductions = deductionItems.map(li => ({
          componentCode: li.componentCode,
          componentName: componentMap.get(li.componentCode)?.name ?? li.componentCode,
          amount: li.amount,
        }));

        // STEP 6.6: Ad-hoc / Variable pay adjustments (Bonuses, Incentives, Arrears, Reimbursements, Loan Deductions)
        const adjustments = await this.adjustmentRepo.findApprovedForEmployeePeriod(
          context.tenantId,
          empId,
          run.year,
          run.month
        );

        for (const adj of adjustments) {
          if (adj.type === AdjustmentType.EARNING) {
            earnings.push({
              componentCode: adj.category,
              componentName: adj.customLabel || adj.category,
              amount: adj.amount,
            });
            grossEarned += adj.amount;
          } else if (adj.type === AdjustmentType.DEDUCTION) {
            deductions.push({
              componentCode: adj.category,
              componentName: adj.customLabel || adj.category,
              amount: adj.amount,
            });
          }
        }

        // STEP 8: Calculate Statutory Deductions via Country Strategy Plugin
        let hasPrecedingContributions = false;
        if (countryCode === "IN" && statutory.esiEnabled && grossEarned > 21000) {
          const precedingMonths = getPrecedingMonthsOfContributionPeriod(run.year, run.month);
          if (precedingMonths.length > 0) {
            hasPrecedingContributions = await this.payslipRepo.hasEsiContributionInMonths(
              context,
              empId,
              precedingMonths
            );
          }
        }

        const basicItem = earnings.find(e => e.componentCode === "BASIC");
        const hraItem = earnings.find(e => e.componentCode === "HRA");

        const statutoryResult = await strategy.calculateStatutoryDeductions({
          tenantId: context.tenantId,
          branchId,
          employeeId: empId,
          countryCode,
          currency,
          stateOrRegionCode: stateCode,
          month: run.month,
          year: run.year,
          financialYear,
          monthsRemainingInFY: monthsRemaining,
          payableDays: attendanceSummary.payableDays,
          totalDaysInMonth: attendanceSummary.totalDaysInMonth,
          grossEarned,
          wagesForStatutory: structure.wagesForStatutory,
          annualCtc: structure.ctcAnnual,
          basicMonthly: basicItem?.amount ?? 0,
          hraMonthly: hraItem?.amount ?? 0,
          employee,
          statutoryFlags: statutory,
          hasPrecedingContributions,
        });

        // STEP 9: Append statutory employee deductions
        for (const statItem of statutoryResult.employeeDeductions) {
          deductions.push({
            componentCode: statItem.code,
            componentName: statItem.name,
            amount: statItem.amount,
          });
        }

        // STEP 10: Net pay computation
        const totalDeductionsAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
        const netPay = Math.round((grossEarned - totalDeductionsAmount) * 100) / 100;

        // STEP 11: Hard block on negative net pay
        assertPositiveNetPay(empId, netPay, grossEarned, totalDeductionsAmount);

        // STEP 12: Combine all statutory line items for global breakdown snapshot
        const statutoryBreakdown = [
          ...statutoryResult.employeeDeductions.map(d => ({
            code: d.code,
            name: d.name,
            amount: d.amount,
            isEmployer: false,
          })),
          ...statutoryResult.employerContributions.map(c => ({
            code: c.code,
            name: c.name,
            amount: c.amount,
            isEmployer: true,
          })),
        ];

        // STEP 13: Save payslip with multi-country & multi-currency metadata
        await this.payslipRepo.create({
          tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
          branchId: employee.branchId as any,
          payrollRunId: run._id as any,
          employeeId: employee._id as any,
          salaryStructureId: structure._id as any,
          month: run.month,
          year: run.year,
          countryCode,
          currency,
          attendanceSummary,
          earnings,
          deductions,
          grossEarned: Math.round(grossEarned * 100) / 100,
          totalDeductions: totalDeductionsAmount,
          lopAmount,
          netPay,
          statutoryBreakdown,
          totalEmployerStatutoryCost: statutoryResult.totalEmployerStatutoryCost,
          pfEmployeeContribution: statutoryResult.metadata?.pfEmployee || 0,
          pfEmployerContribution: statutoryResult.metadata?.pfEmployer || 0,
          esiEmployeeContribution: statutoryResult.metadata?.esiEmployee || 0,
          esiEmployerContribution: statutoryResult.metadata?.esiEmployer || 0,
          ptAmount: statutoryResult.metadata?.ptAmount || 0,
          lwfEmployeeAmount: statutoryResult.metadata?.lwfEmployee || 0,
          lwfEmployerAmount: statutoryResult.metadata?.lwfEmployer || 0,
          tdsAmount: statutoryResult.metadata?.tdsAmount || 0,
          taxRegime: statutoryResult.taxRegimeOrBracket,
          annualTaxableIncome: statutoryResult.annualTaxableIncome,
          gratuityMonthlyProvision: statutoryResult.gratuityOrEndServiceProvision,
          isFinalized: false,
        });

        totalGross += grossEarned;
        totalDeductions += totalDeductionsAmount;
        totalNet += netPay;
        generatedCount++;

      } catch (empError: any) {
        // Per-employee errors collected — don't kill the whole run
        errored.push(`${empLabel}: ${empError.message}`);
      }
    }

    // ── Update run totals ──────────────────────────────────────────────────
    run.status = PayrollRunStatus.GENERATED;
    run.totalEmployees = generatedCount;
    run.totalGrossAmount = Math.round(totalGross * 100) / 100;
    run.totalDeductionsAmount = Math.round(totalDeductions * 100) / 100;
    run.totalNetAmount = Math.round(totalNet * 100) / 100;
    run.generatedAt = new Date();
    run.skippedEmployees = skipped;
    run.erroredEmployees = errored;
    await this.runRepo.save(run);

    // Mark processed adjustments
    const allApprovedAdjustments = await this.adjustmentRepo.findByFilter(
      context,
      { year: run.year, month: run.month, status: "APPROVED" },
      1,
      10000
    );
    const adjustmentIds = allApprovedAdjustments.items.map((a: any) => a._id);
    if (adjustmentIds.length > 0) {
      await this.adjustmentRepo.markProcessedForRun(
        context.tenantId,
        adjustmentIds,
        run._id as any
      );
    }

    return {
      run,
      generatedCount,
      skippedCount: skipped.length,
      errorCount: errored.length,
      skipped,
      errors: errored,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APPROVE — maker-checker enforced
  // Creator of the run cannot be the approver
  // ─────────────────────────────────────────────────────────────────────────

  async approve(
    context: RequestContext,
    runId: string,
    input: ApprovePayrollRunInput
  ) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    if (run.status !== PayrollRunStatus.GENERATED) {
      throw new AppError(
        `Cannot approve — run status is ${run.status}, expected GENERATED`,
        400
      );
    }

    // Maker-checker: creator cannot approve their own run
    const createdBy = (run as any).createdBy?.toString();
    if (createdBy && createdBy === context.userId) {
      throw new AppError(
        "Maker-checker violation: The person who created this payroll run cannot approve it.",
        403
      );
    }

    run.status = PayrollRunStatus.APPROVED;
    run.approvedBy = new mongoose.Types.ObjectId(context.userId);
    run.approvedAt = new Date();
    if (input.notes) run.notes = input.notes;
    await this.runRepo.save(run);

    // Freeze all payslips — immutable after approval
    await PayslipModel.updateMany(
      { tenantId: run.tenantId, payrollRunId: run._id },
      { isFinalized: true }
    );

    return run;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MARK PAID
  // Links attendance lock to this run — prevents unlock after disbursement
  // ─────────────────────────────────────────────────────────────────────────

  async markPaid(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new AppError(
        `Cannot mark paid — run status is ${run.status}, expected APPROVED`,
        400
      );
    }

    run.status = PayrollRunStatus.PAID;
    run.paidAt = new Date();
    await this.runRepo.save(run);

    // Link payroll run to attendance lock
    // Prevents HR from unlocking attendance after salaries have been disbursed
    const branchId = (run.branchId as mongoose.Types.ObjectId).toString();
    const period = `${run.year}-${String(run.month).padStart(2, "0")}`;

    await AttendanceLockModel.findOneAndUpdate(
      {
        tenantId: run.tenantId,
        branchId: new mongoose.Types.ObjectId(branchId),
        period,
      },
      { payrollRunId: run._id }
    );

    return run;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STANDARD CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async list(
    context: RequestContext,
    page: number,
    pageSize: number,
    filter?: { branchId?: string; year?: number; month?: number; status?: string }
  ) {
    return this.runRepo.findAll(context, page, pageSize, filter);
  }

  async getById(context: RequestContext, id: string) {
    const run = await this.runRepo.findById(context, id);
    if (!run) throw new AppError("Payroll run not found", 404);
    return run;
  }

  async getPayslips(context: RequestContext, runId: string) {
    return this.payslipRepo.findByRun(context, runId);
  }
}