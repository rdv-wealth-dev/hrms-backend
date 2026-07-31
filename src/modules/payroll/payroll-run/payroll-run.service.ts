import mongoose from "mongoose";
import { PayrollRunRepository } from "../payroll-run/payroll-run.repository";
import { PayslipRepository } from "../payslip/payslip.repository";
import { SalaryStructureRepository } from "../salary-structures/salary-structure.repository";
import { SalaryComponentRepository } from "../salary-components/salary-component.repository";
import { PayrollRunStatus } from "../payroll-run/payroll-run.model";
import { PayslipModel } from "../payslip/payslip.model";
import { CreatePayrollRunInput, ApprovePayrollRunInput } from "../payroll.dto";
import { AppError } from "../../../core/errors/app.error";
import { RequestContext } from "../../../core/interfaces/request-context.interface";
import { EmployeeModel } from "../../employee/core/employee.model";
import { OrganizationModel } from "../../organization/organization.model";
import { BranchModel } from "../../branch/branch.model";
import { AttendanceModel } from "../../attendance/core/attendance.model";
import { AttendanceLockModel, AttendanceLockStatus } from "../../attendance/core/attendance-lock.model";
import { ComponentType } from "../salary-components/salary-component.model";

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
} from "../payroll.util";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export class PayrollRunService {
  private runRepo       = new PayrollRunRepository();
  private payslipRepo   = new PayslipRepository();
  private structureRepo = new SalaryStructureRepository();
  private componentRepo = new SalaryComponentRepository();

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE RUN
  // ─────────────────────────────────────────────────────────────────────────

  async createRun(context: RequestContext, input: CreatePayrollRunInput) {
    const existing = await this.runRepo.findByMonthYear(
      context, input.year, input.month
    );
    if (existing) {
      throw new AppError(
        `A payroll run for ${MONTH_NAMES[input.month - 1]} ${input.year} already exists`,
        409
      );
    }

    return this.runRepo.create({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:  new mongoose.Types.ObjectId(context.branchIds[0] ?? "") as any,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      month:     input.month,
      year:      input.year,
      runLabel:  `${MONTH_NAMES[input.month - 1]} ${input.year}`,
      status:    PayrollRunStatus.DRAFT,
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
    const period   = `${run.year}-${String(run.month).padStart(2, "0")}`;
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

    // ── Check 2: Per-employee validation ──────────────────────────────────
    const employees = await EmployeeModel.find({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(branchId),
      isActive:  true,
      isDeleted: false,
    }).select("_id employeeCode firstName lastName pan").lean();

    const fromDate = new Date(run.year, run.month - 1, 1);
    const toDate   = new Date(run.year, run.month, 0, 23, 59, 59);

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

      // Attendance data exists for this period?
      const attCount = await AttendanceModel.countDocuments({
        tenantId:       new mongoose.Types.ObjectId(context.tenantId),
        employeeId:     emp._id,
        attendanceDate: { $gte: fromDate, $lte: toDate },
        isDeleted:      false,
      });

      if (attCount === 0) {
        errors.push(
          `${empLabel}: No attendance records found for ${period}.`
        );
      }
    }

    // Save validation results to the run record
    run.validatedAt      = new Date();
    run.validationErrors = errors;
    await this.runRepo.save(run);

    return {
      valid:        errors.filter(e => e.startsWith("CRITICAL")).length === 0
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
      pfEnabled:  boolean;
      esiEnabled: boolean;
      ptEnabled:  boolean;
      tdsEnabled: boolean;
      lwfEnabled: boolean;
    };

    // ── Load branch state code for PT + LWF ───────────────────────────────
    const branch = await BranchModel.findById(branchId)
      .select("address")
      .lean();
    const stateCode = (branch as any)?.address?.state?.toUpperCase() ?? "";

    const financialYear   = getFinancialYear(run.year, run.month);
    const monthsRemaining = getMonthsRemainingInFY(run.month);

    // ── Fetch all active employees for this branch ─────────────────────────
    const employees = await EmployeeModel.find({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(branchId),
      isActive:  true,
      isDeleted: false,
    }).lean();

    run.status = PayrollRunStatus.PROCESSING;
    await this.runRepo.save(run);

    let totalGross = 0, totalDeductions = 0, totalNet = 0, generatedCount = 0;
    const skipped: string[] = [];
    const errored: string[] = [];

    // ── PER-EMPLOYEE LOOP ──────────────────────────────────────────────────
    for (const employee of employees) {
      const empId    = (employee._id as mongoose.Types.ObjectId).toString();
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
        const components     = await this.componentRepo.findAllByCodes(
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
            amount:        Math.round(otAmount * 100) / 100,
          });
          grossEarned += otAmount;
        }

        // STEP 7: Fixed deductions from salary structure
        const deductions = deductionItems.map(li => ({
          componentCode: li.componentCode,
          componentName: componentMap.get(li.componentCode)?.name ?? li.componentCode,
          amount:        li.amount,
        }));

        // STEP 8: PF — on pro-rated wages
        const wagesRatio    = attendanceSummary.payableDays / attendanceSummary.totalDaysInMonth;
        const proRatedWages = Math.round(structure.wagesForStatutory * wagesRatio);
        const pf            = calculatePF(proRatedWages, !!statutory.pfEnabled, employee.countryCode || "IN");
        const pfEmployeeAnnual = pf.employee * 12;

        // STEP 9: ESIC — on pro-rated gross
        const esi = calculateESI(grossEarned, !!statutory.esiEnabled, employee.countryCode || "IN");

        // STEP 10: Professional Tax — DB-driven state slabs
        const pt = await calculatePT(
          context.tenantId,
          grossEarned,
          stateCode,
          !!statutory.ptEnabled,
          financialYear
        );

        // STEP 11: LWF — only in configured months (June/December etc.)
        const lwf = await calculateLWF(
          context.tenantId,
          stateCode,
          run.month,
          financialYear,
          !!statutory.lwfEnabled
        );

        // STEP 12: TDS — full 11-step engine with regime + declarations
        const basicItem = earnings.find(e => e.componentCode === "BASIC");
        const hraItem   = earnings.find(e => e.componentCode === "HRA");

        // No PAN → flat 20% TDS per Section 206AA
        let tdsResult;
        if (!employee.pan) {
          const flatTDS = Math.round(grossEarned * 0.20);
          tdsResult = {
            annualTaxableIncome: grossEarned * 12,
            annualTax:           flatTDS * 12,
            annualTaxWithCess:   flatTDS * 12,
            monthlyTDS:          flatTDS,
            regime:              "NEW" as any,
          };
        } else {
          tdsResult = await calculateTDS(
            context.tenantId,
            empId,
            structure.ctcAnnual,
            basicItem?.amount   ?? 0,
            hraItem?.amount     ?? 0,
            pfEmployeeAnnual,
            financialYear,
            !!statutory.tdsEnabled,
            monthsRemaining
          );
        }

        // STEP 13: Push statutory deductions in correct order
        if (pf.employee > 0)
          deductions.push({ componentCode: "PF",  componentName: "Provident Fund",             amount: pf.employee });
        if (esi.employee > 0)
          deductions.push({ componentCode: "ESI", componentName: "Employee State Insurance",    amount: esi.employee });
        if (pt > 0)
          deductions.push({ componentCode: "PT",  componentName: "Professional Tax",            amount: pt });
        if (lwf.employee > 0)
          deductions.push({ componentCode: "LWF", componentName: "Labour Welfare Fund",         amount: lwf.employee });
        if (tdsResult.monthlyTDS > 0)
          deductions.push({ componentCode: "TDS", componentName: "Tax Deducted at Source",      amount: tdsResult.monthlyTDS });

        // STEP 14: Net pay
        const totalDeductionsAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
        const netPay = Math.round((grossEarned - totalDeductionsAmount) * 100) / 100;

        // STEP 15: Hard block on negative net pay
        assertPositiveNetPay(empId, netPay, grossEarned, totalDeductionsAmount);

        // STEP 16: Gratuity provision (employer cost — NOT deducted from employee)
        const gratuityProvision = calculateMonthlyGratuityProvision(
          basicItem?.amount ?? 0  // Basic + DA (DA = 0 for most private orgs)
        );

        // STEP 17: Save payslip
        await this.payslipRepo.create({
          tenantId:                new mongoose.Types.ObjectId(context.tenantId) as any,
          branchId:                employee.branchId as any,
          payrollRunId:            run._id as any,
          employeeId:              employee._id as any,
          salaryStructureId:       structure._id as any,
          month:                   run.month,
          year:                    run.year,
          attendanceSummary,
          earnings,
          deductions,
          grossEarned:             Math.round(grossEarned * 100) / 100,
          totalDeductions:         totalDeductionsAmount,
          lopAmount,
          netPay,
          pfEmployeeContribution:  pf.employee,
          pfEmployerContribution:  pf.totalEmployer,
          esiEmployeeContribution: esi.employee,
          esiEmployerContribution: esi.employer,
          ptAmount:                pt,
          lwfEmployeeAmount:       lwf.employee,
          lwfEmployerAmount:       lwf.employer,
          tdsAmount:               tdsResult.monthlyTDS,
          taxRegime:               tdsResult.regime,
          annualTaxableIncome:     tdsResult.annualTaxableIncome,
          gratuityMonthlyProvision: gratuityProvision,
          isFinalized:             false,
        });

        totalGross      += grossEarned;
        totalDeductions += totalDeductionsAmount;
        totalNet        += netPay;
        generatedCount++;

      } catch (empError: any) {
        // Per-employee errors collected — don't kill the whole run
        errored.push(`${empLabel}: ${empError.message}`);
      }
    }

    // ── Update run totals ──────────────────────────────────────────────────
    run.status                = PayrollRunStatus.GENERATED;
    run.totalEmployees        = generatedCount;
    run.totalGrossAmount      = Math.round(totalGross * 100) / 100;
    run.totalDeductionsAmount = Math.round(totalDeductions * 100) / 100;
    run.totalNetAmount        = Math.round(totalNet * 100) / 100;
    run.generatedAt           = new Date();
    run.skippedEmployees      = skipped;
    run.erroredEmployees      = errored;
    await this.runRepo.save(run);

    return {
      run,
      generatedCount,
      skippedCount: skipped.length,
      errorCount:   errored.length,
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
    runId:   string,
    input:   ApprovePayrollRunInput
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

    run.status     = PayrollRunStatus.APPROVED;
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
    const period   = `${run.year}-${String(run.month).padStart(2, "0")}`;

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

  async list(context: RequestContext, page: number, pageSize: number) {
    return this.runRepo.findAll(context, page, pageSize);
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