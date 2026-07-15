import mongoose from "mongoose";
import { PayrollRunRepository } from "./payroll-run.repository";
import { PayslipRepository } from "./payslip.repository";
import { SalaryStructureRepository } from "./salary-structure.repository";
import { SalaryComponentRepository } from "./salary-component.repository";
import { PayrollRunStatus } from "./payroll-run.model";
import { PayslipModel } from "./payslip.model";
import { CreatePayrollRunInput, ApprovePayrollRunInput } from "./payroll.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { EmployeeModel } from "../employee/employee.model";
import { OrganizationModel } from "../organization/organization.model";
import {
  buildAttendanceSummary,
  proRateEarnings,
  calculatePF,
  calculateESI,
  calculatePT,
  calculateTDS,
} from "./payroll.util";
import { ComponentType } from "./salary-component.model";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export class PayrollRunService {
  private runRepo       = new PayrollRunRepository();
  private payslipRepo    = new PayslipRepository();
  private structureRepo  = new SalaryStructureRepository();
  private componentRepo  = new SalaryComponentRepository();

  async createRun(context: RequestContext, input: CreatePayrollRunInput) {
    const existing = await this.runRepo.findByMonthYear(context, input.year, input.month);
    if (existing) {
      throw new AppError(`A payroll run for ${MONTH_NAMES[input.month - 1]} ${input.year} already exists`, 409);
    }

    return this.runRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: new mongoose.Types.ObjectId(context.branchIds[0] ?? "") as any,
      month: input.month,
      year:  input.year,
      runLabel: `${MONTH_NAMES[input.month - 1]} ${input.year}`,
      status: PayrollRunStatus.DRAFT,
    });
  }

  // ─── The core orchestration — generates a payslip per active employee ──────
  async generatePayslips(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new AppError(`Cannot generate payslips — run status is ${run.status}, expected DRAFT`, 400);
    }

    run.status = PayrollRunStatus.PROCESSING;
    await this.runRepo.save(run);

    const org = await OrganizationModel.findById(context.tenantId).select("statutory");
    const statutory = (org?.statutory ?? {}) as {
      pfEnabled: boolean;
      esiEnabled: boolean;
      ptEnabled: boolean;
      tdsEnabled: boolean;
      lwfEnabled: boolean;
    };

    const employees = await EmployeeModel.find({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      branchId:  new mongoose.Types.ObjectId(context.branchIds[0] ?? ""),
      isActive:  true,
      isDeleted: false,
    });

    let totalGross = 0, totalDeductions = 0, totalNet = 0, generatedCount = 0;

    for (const employee of employees) {
      const structure = await this.structureRepo.findActiveForEmployee(context, employee._id.toString());
      if (!structure) continue; // skip employees with no salary structure configured yet

      const alreadyExists = await this.payslipRepo.existsForRunAndEmployee(context, runId, employee._id.toString());
      if (alreadyExists) continue;

      // This line is the literal Attendance/Leave interlink 
      const attendanceSummary = await buildAttendanceSummary(
        context.tenantId, employee._id.toString(), run.year, run.month
      );

      const componentCodes = structure.lineItems.map(li => li.componentCode);
      const components = await this.componentRepo.findAllByCodes(context, componentCodes);
      const componentMap = new Map(components.map(c => [c.code, c]));

      const earningLineItems = structure.lineItems.filter(
        li => componentMap.get(li.componentCode)?.type === ComponentType.EARNING
      );
      const deductionLineItems = structure.lineItems.filter(
        li => componentMap.get(li.componentCode)?.type === ComponentType.DEDUCTION
      );

      const earnings = proRateEarnings(
        earningLineItems, attendanceSummary.payableDays, attendanceSummary.totalDaysInMonth
      ).map(e => ({
        ...e,
        componentName: componentMap.get(e.componentCode)?.name ?? e.componentCode,
      }));

      const grossEarned = earnings.reduce((sum, e) => sum + e.amount, 0);
      const lopAmount = structure.grossMonthly - grossEarned;

      const deductions = deductionLineItems.map(li => ({
        componentCode: li.componentCode,
        componentName: componentMap.get(li.componentCode)?.name ?? li.componentCode,
        amount: li.amount,
      }));

      // Statutory deductions computed off the pro-rated wages figure
      const wagesRatio = attendanceSummary.payableDays / attendanceSummary.totalDaysInMonth;
      const proRatedWages = Math.round(structure.wagesForStatutory * wagesRatio);

      const pf  = calculatePF(proRatedWages, !!statutory.pfEnabled);
      const esi = calculateESI(grossEarned, !!statutory.esiEnabled);
      const pt  = calculatePT(grossEarned, !!statutory.ptEnabled);
      const tds = calculateTDS(structure.ctcAnnual, !!statutory.tdsEnabled);

      if (pf.employee > 0)  deductions.push({ componentCode: "PF",  componentName: "Provident Fund",       amount: pf.employee });
      if (esi.employee > 0) deductions.push({ componentCode: "ESI", componentName: "Employee State Insurance", amount: esi.employee });
      if (pt > 0)            deductions.push({ componentCode: "PT",  componentName: "Professional Tax",      amount: pt });
      if (tds > 0)            deductions.push({ componentCode: "TDS", componentName: "Tax Deducted at Source", amount: tds });

      const totalDeductionsAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
      const netPay = grossEarned - totalDeductionsAmount;

      await this.payslipRepo.create({
        tenantId:          new mongoose.Types.ObjectId(context.tenantId) as any,
        branchId:          employee.branchId as any,
        payrollRunId:      run._id as any,
        employeeId:        employee._id as any,
        salaryStructureId: structure._id as any,
        month: run.month, year: run.year,
        attendanceSummary,
        earnings, deductions,
        grossEarned, totalDeductions: totalDeductionsAmount, lopAmount, netPay,
        pfEmployeeContribution:  pf.employee,
        pfEmployerContribution:  pf.employer,
        esiEmployeeContribution: esi.employee,
        esiEmployerContribution: esi.employer,
        ptAmount:  pt,
        tdsAmount: tds,
        isFinalized: false,
      });

      totalGross += grossEarned;
      totalDeductions += totalDeductionsAmount;
      totalNet += netPay;
      generatedCount++;
    }

    run.status = PayrollRunStatus.GENERATED;
    run.totalEmployees = generatedCount;
    run.totalGrossAmount = totalGross;
    run.totalDeductionsAmount = totalDeductions;
    run.totalNetAmount = totalNet;
    run.generatedAt = new Date();
    await this.runRepo.save(run);

    return run;
  }

  async getPayslips(context: RequestContext, runId: string) {
    return this.payslipRepo.findByRun(context, runId);
  }

  async approve(context: RequestContext, runId: string, input: ApprovePayrollRunInput) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);
    if (run.status !== PayrollRunStatus.GENERATED) {
      throw new AppError(`Cannot approve — run status is ${run.status}, expected GENERATED`, 400);
    }

    run.status = PayrollRunStatus.APPROVED;
    run.approvedBy = new mongoose.Types.ObjectId(context.userId);
    run.approvedAt = new Date();
    if (input.notes) run.notes = input.notes;
    await this.runRepo.save(run);

    // Finalize every payslip — immutable from this point
    await PayslipModel.updateMany(
      { tenantId: run.tenantId, payrollRunId: run._id },
      { isFinalized: true }
    );

    return run;
  }

  async markPaid(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);
    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new AppError(`Cannot mark paid — run status is ${run.status}, expected APPROVED`, 400);
    }
    run.status = PayrollRunStatus.PAID;
    run.paidAt = new Date();
    await this.runRepo.save(run);
    return run;
  }

  async list(context: RequestContext, page: number, pageSize: number) {
    return this.runRepo.findAll(context, page, pageSize);
  }

  async getById(context: RequestContext, id: string) {
    const run = await this.runRepo.findById(context, id);
    if (!run) throw new AppError("Payroll run not found", 404);
    return run;
  }
}