import mongoose from "mongoose";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayslipRepository } from "../repositories/payslip.repository";
import { EmployeeModel } from "../../employee/models/employee.model";
import { BranchModel } from "../../branch/branch.model";
import { OrganizationModel } from "../../organization/organization.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class PayrollComplianceService {
  private runRepo = new PayrollRunRepository();
  private payslipRepo = new PayslipRepository();

  private async getRunAndPayslips(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    const payslips = await this.payslipRepo.findByRun(context, runId);
    const employeeIds = payslips.map((p) => p.employeeId.toString());

    const [employees, branch, organization] = await Promise.all([
      EmployeeModel.find({
        _id: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      })
        .select("_id employeeCode firstName lastName pan pfOnActuals")
        .lean(),
      BranchModel.findById(run.branchId).lean(),
      OrganizationModel.findById(context.tenantId).lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e._id.toString(), e]));

    return { run, payslips, empMap, branch, organization };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. EPFO ECR GENERATOR (Electronic Challan cum Return)
  // Format: UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_SHARE#~#EPS_SHARE#~#ER_EPF_SHARE#~#NCP_DAYS#~#REFUND_ADVANCES
  // ─────────────────────────────────────────────────────────────────────────
  async generateEpfoEcr(context: RequestContext, runId: string) {
    const { run, payslips, empMap } = await this.getRunAndPayslips(context, runId);
    const pfPayslips = payslips.filter((p) => (p.pfEmployeeContribution || 0) > 0);

    const rows: string[] = [];

    for (const p of pfPayslips) {
      const emp = empMap.get(p.employeeId.toString());
      const memberName = emp ? `${emp.firstName} ${emp.lastName}`.trim().toUpperCase() : "EMPLOYEE";
      const uan = emp?.employeeCode || "100000000000"; // Fallback identifier / UAN
      const grossWages = Math.round(p.grossEarned);

      // EPF Wages (capped at 15000 unless pfOnActuals is true)
      const epfWages = emp?.pfOnActuals ? grossWages : Math.min(15000, grossWages);
      const epsWages = Math.min(15000, epfWages);
      const edliWages = epsWages;

      const eeShare = p.pfEmployeeContribution || Math.round(epfWages * 0.12);
      const epsShare = Math.min(1250, Math.round(epsWages * 0.0833));
      const erEpfShare = Math.max(0, (p.pfEmployerContribution || Math.round(epfWages * 0.12)) - epsShare);

      // NCP (Non-Contributing Period) Days = Absent days + Unpaid Leave days
      const ncpDays = (p.attendanceSummary?.absentDays || 0) + (p.attendanceSummary?.unpaidLeaveDays || 0);
      const refundOfAdvances = 0;

      rows.push(
        `${uan}#~#${memberName}#~#${grossWages}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${eeShare}#~#${epsShare}#~#${erEpfShare}#~#${ncpDays}#~#${refundOfAdvances}`
      );
    }

    const content = rows.join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return {
      filename: `EPFO_ECR_${run.year}_${run.month}_${dateStr}.txt`,
      contentType: "text/plain",
      recordCount: pfPayslips.length,
      content,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ESIC MONTHLY RETURN CSV GENERATOR
  // Format: IP_Number,IP_Name,No_Of_Days_Wages_Paid,Total_Monthly_Wages,IP_Contribution,Reason_Code
  // ─────────────────────────────────────────────────────────────────────────
  async generateEsicReturn(context: RequestContext, runId: string) {
    const { run, payslips, empMap } = await this.getRunAndPayslips(context, runId);
    const esiPayslips = payslips.filter((p) => (p.esiEmployeeContribution || 0) > 0);

    const headers = "IP_Number,IP_Name,No_Of_Days_Wages_Paid,Total_Monthly_Wages,IP_Contribution,Reason_Code";
    const rows = esiPayslips.map((p) => {
      const emp = empMap.get(p.employeeId.toString());
      const ipName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "EMPLOYEE";
      const ipNumber = emp?.employeeCode || "0000000000";
      const payableDays = p.attendanceSummary?.payableDays || 0;
      const grossWages = Math.round(p.grossEarned);
      const ipContribution = p.esiEmployeeContribution || 0;
      const reasonCode = payableDays === 0 ? "1" : "0"; // 0 = Regular, 1 = On Leave

      return `${ipNumber},"${ipName.replace(/"/g, '""')}",${payableDays},${grossWages},${ipContribution},${reasonCode}`;
    });

    const content = [headers, ...rows].join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return {
      filename: `ESIC_Monthly_Return_${run.year}_${run.month}_${dateStr}.csv`,
      contentType: "text/csv",
      recordCount: esiPayslips.length,
      content,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PROFESSIONAL TAX (PT) STATEMENT
  // ─────────────────────────────────────────────────────────────────────────
  async generatePtStatement(context: RequestContext, runId: string) {
    const { run, payslips, empMap, branch } = await this.getRunAndPayslips(context, runId);
    const ptPayslips = payslips.filter((p) => (p.ptAmount || 0) > 0);

    const state = branch?.address?.state || "DEFAULT";
    const totalPtAmount = ptPayslips.reduce((sum, p) => sum + (p.ptAmount || 0), 0);

    const employeeRecords = ptPayslips.map((p) => {
      const emp = empMap.get(p.employeeId.toString());
      return {
        employeeCode: emp?.employeeCode || "N/A",
        employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Unknown",
        grossSalary: p.grossEarned,
        ptAmount: p.ptAmount || 0,
      };
    });

    return {
      runId,
      runLabel: run.runLabel,
      state,
      totalEmployeesAssessed: payslips.length,
      ptCoveredEmployees: ptPayslips.length,
      totalPtAmount,
      employeeRecords,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. TDS FORM 24Q MONTHLY REGISTER
  // ─────────────────────────────────────────────────────────────────────────
  async generateTds24QRegister(context: RequestContext, runId: string) {
    const { run, payslips, empMap } = await this.getRunAndPayslips(context, runId);
    const tdsPayslips = payslips.filter((p) => (p.tdsAmount || 0) > 0);

    const headers = "Employee_Code,Employee_Name,PAN_Number,Gross_Earnings,Taxable_Income,TDS_Deducted,Tax_Regime";
    const rows = payslips.map((p) => {
      const emp = empMap.get(p.employeeId.toString());
      const pan = emp?.pan || "PANNOTAVBL";
      const name = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Unknown";
      return `${emp?.employeeCode || "N/A"},"${name.replace(/"/g, '""')}",${pan},${p.grossEarned.toFixed(2)},${(p.annualTaxableIncome || 0).toFixed(2)},${(p.tdsAmount || 0).toFixed(2)},${p.taxRegime || "NEW"}`;
    });

    const content = [headers, ...rows].join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return {
      filename: `TDS_Form24Q_Register_${run.year}_${run.month}_${dateStr}.csv`,
      contentType: "text/csv",
      totalTdsDeducted: tdsPayslips.reduce((sum, p) => sum + (p.tdsAmount || 0), 0),
      content,
    };
  }
}
