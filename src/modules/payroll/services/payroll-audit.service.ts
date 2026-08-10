import mongoose from "mongoose";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayslipRepository } from "../repositories/payslip.repository";
import { EmployeeModel } from "../../employee/models/employee.model";
import { EmployeeBankAccountModel } from "../../employee/models/employee-bank-account.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export interface VarianceAnalysisOptions {
  thresholdPercent?: number; // e.g. 5 means flag if change > 5%
  compareRunId?: string; // optional explicit previous run ID
}

export class PayrollAuditService {
  private runRepo = new PayrollRunRepository();
  private payslipRepo = new PayslipRepository();

  async getVarianceAndAuditReport(
    context: RequestContext,
    runId: string,
    options: VarianceAnalysisOptions = {}
  ) {
    const threshold = options.thresholdPercent ?? 5;
    const currentRun = await this.runRepo.findById(context, runId);
    if (!currentRun) throw new AppError("Payroll run not found", 404);

    // 1. Fetch current run payslips
    const currentPayslips = await this.payslipRepo.findByRun(context, runId);
    const employeeIds = currentPayslips.map((p) => p.employeeId.toString());

    // Fetch employee details (PAN, bank details, names)
    const [employees, bankAccounts] = await Promise.all([
      EmployeeModel.find({
        _id: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      })
        .select("employeeCode firstName lastName email pan")
        .lean(),
      EmployeeBankAccountModel.find({
        employeeId: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
      }).lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e._id.toString(), e]));
    const bankMap = new Map<string, any>();
    for (const bank of bankAccounts) {
      const empId = bank.employeeId.toString();
      if (!bankMap.has(empId) || bank.isPrimary) {
        bankMap.set(empId, bank);
      }
    }

    // 2. Determine previous run
    let previousRun = null;
    let prevPayslips: any[] = [];
    if (options.compareRunId) {
      previousRun = await this.runRepo.findById(context, options.compareRunId);
    } else {
      // Automatic previous month calculation
      let prevMonth = currentRun.month - 1;
      let prevYear = currentRun.year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      previousRun = await this.runRepo.findByMonthYear(context, prevYear, prevMonth);
    }

    if (previousRun) {
      prevPayslips = await this.payslipRepo.findByRun(context, previousRun._id.toString());
    }

    const prevPayslipMap = new Map(
      prevPayslips.map((p) => [p.employeeId.toString(), p])
    );

    // 3. Employee-level variances and audit checks
    const employeeVariances: any[] = [];
    const flaggedAnomalies: any[] = [];

    for (const payslip of currentPayslips) {
      const empId = payslip.employeeId.toString();
      const emp = empMap.get(empId);
      const prev = prevPayslipMap.get(empId);

      const empLabel = emp ? `${emp.employeeCode} - ${emp.firstName} ${emp.lastName}` : empId;

      const currentGross = payslip.grossEarned || 0;
      const currentNet = payslip.netPay || 0;
      const prevGross = prev ? prev.grossEarned || 0 : 0;
      const prevNet = prev ? prev.netPay || 0 : 0;

      const grossDelta = currentGross - prevGross;
      const netDelta = currentNet - prevNet;
      const netPercentChange = prevNet > 0 ? (netDelta / prevNet) * 100 : currentNet > 0 ? 100 : 0;
      const isFlagged = Math.abs(netPercentChange) >= threshold;

      const issues: string[] = [];

      // Compliance & Bank Audit checks
      const bank = bankMap.get(empId);
      if (!emp?.pan) {
        issues.push("Missing PAN number (Subject to 20% Section 206AA rate)");
      }
      if (!bank?.accountNumber || !bank?.ifscCode) {
        issues.push("Missing Bank Account Number or IFSC for direct disbursement");
      }
      if (payslip.netPay <= 0) {
        issues.push("Zero or negative net salary detected");
      }

      // Check for high overtime (>20% of gross)
      const otEarning = payslip.earnings.find((e: any) => e.componentCode === "OT");
      if (otEarning && otEarning.amount > 0.2 * currentGross) {
        issues.push(`High overtime payout (₹${otEarning.amount}, >20% of gross)`);
      }

      const itemRecord = {
        employeeId: empId,
        employeeCode: emp?.employeeCode,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        currentGross,
        previousGross: prevGross,
        grossDelta: Math.round(grossDelta * 100) / 100,
        currentNet,
        previousNet: prevNet,
        netDelta: Math.round(netDelta * 100) / 100,
        netPercentChange: Math.round(netPercentChange * 10) / 10,
        isNewJoinerInCycle: !prev,
        isFlagged,
        issues,
      };

      employeeVariances.push(itemRecord);

      if (isFlagged || issues.length > 0) {
        flaggedAnomalies.push({
          ...itemRecord,
          reason: isFlagged
            ? `Net pay changed by ${Math.round(netPercentChange)}% (exceeds threshold ${threshold}%)`
            : "Audit compliance flags",
        });
      }
    }

    // 4. Headcount reconciliations
    const currentEmpSet = new Set(employeeIds);
    const missingEmployeesInCurrentRun = prevPayslips
      .filter((p) => !currentEmpSet.has(p.employeeId.toString()))
      .map((p) => ({
        employeeId: p.employeeId.toString(),
        previousNet: p.netPay,
      }));

    // 5. Aggregate Run Metrics
    const totalCurrentGross = currentRun.totalGrossAmount || 0;
    const totalCurrentNet = currentRun.totalNetAmount || 0;
    const totalCurrentDeductions = currentRun.totalDeductionsAmount || 0;

    const totalPrevGross = previousRun ? previousRun.totalGrossAmount || 0 : 0;
    const totalPrevNet = previousRun ? previousRun.totalNetAmount || 0 : 0;
    const totalPrevDeductions = previousRun ? previousRun.totalDeductionsAmount || 0 : 0;

    const aggregateGrossDelta = totalCurrentGross - totalPrevGross;
    const aggregateNetDelta = totalCurrentNet - totalPrevNet;

    return {
      runId,
      period: `${currentRun.year}-${String(currentRun.month).padStart(2, "0")}`,
      status: currentRun.status,
      comparisonPeriod: previousRun
        ? `${previousRun.year}-${String(previousRun.month).padStart(2, "0")}`
        : "None (Initial Run)",
      thresholdPercentApplied: threshold,
      summary: {
        totalEmployeesCurrent: currentPayslips.length,
        totalEmployeesPrevious: prevPayslips.length,
        newJoinersProcessed: currentPayslips.length - (prevPayslips.length - missingEmployeesInCurrentRun.length),
        employeesNotPresentInCurrentRun: missingEmployeesInCurrentRun.length,
        totalGross: totalCurrentGross,
        previousTotalGross: totalPrevGross,
        grossDelta: Math.round(aggregateGrossDelta * 100) / 100,
        grossPercentChange: totalPrevGross > 0 ? Math.round((aggregateGrossDelta / totalPrevGross) * 1000) / 10 : 0,
        totalNet: totalCurrentNet,
        previousTotalNet: totalPrevNet,
        netDelta: Math.round(aggregateNetDelta * 100) / 100,
        netPercentChange: totalPrevNet > 0 ? Math.round((aggregateNetDelta / totalPrevNet) * 1000) / 10 : 0,
        totalDeductions: totalCurrentDeductions,
        previousTotalDeductions: totalPrevDeductions,
      },
      auditFlags: {
        totalFlagged: flaggedAnomalies.length,
        missingBankDetailsCount: employeeVariances.filter((e) =>
          e.issues.some((i: string) => i.includes("Missing Bank"))
        ).length,
        missingPanCount: employeeVariances.filter((e) =>
          e.issues.some((i: string) => i.includes("Missing PAN"))
        ).length,
        negativeNetCount: employeeVariances.filter((e) =>
          e.issues.some((i: string) => i.includes("negative net"))
        ).length,
        flaggedAnomalies,
      },
      employeeVariances,
    };
  }
}
