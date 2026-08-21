import { PayslipDocument } from "../models/payslip.model";
import { PayrollRunDocument } from "../models/payroll-run.model";
import { PfEsiConfigDocument } from "../models/statutory-config.model";

export class EpfoEsicComplianceService {
  /**
   * Generates EPFO Electronic Challan cum Return (ECR) in official #~# text file format.
   * Fully customizable: Supports custom PF wage ceiling, disabling PF, full uncapped basic, and custom contribution rates.
   */
  public static generateEpfoEcrText(
    run: PayrollRunDocument,
    payslips: any[],
    customConfig?: Partial<PfEsiConfigDocument>
  ): string {
    // If organization has disabled PF compliance (e.g. exempt or <20 employees)
    if (customConfig && customConfig.isPfEnabled === false) {
      return "";
    }

    const lines: string[] = [];
    const wageCeiling = customConfig?.pfWageCeiling !== undefined ? customConfig.pfWageCeiling : 15000;
    const restrictCeiling = customConfig?.restrictPfToWageCeiling !== false;
    const eeRate = customConfig?.employeePfRate !== undefined ? customConfig.employeePfRate : 0.12;
    const epsRate = customConfig?.epsRate !== undefined ? customConfig.epsRate : 0.0833;
    const epsCap = customConfig?.epsCeilingAmount !== undefined ? customConfig.epsCeilingAmount : 1250;
    const isEpsEnabled = customConfig?.isEpsEnabled !== false;

    for (const payslip of payslips) {
      const emp = payslip.employeeId || {};
      const uan = emp.identityDetails?.uan || emp.identityDetails?.pfUan || "100000000000";
      const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toUpperCase() || "EMPLOYEE";
      
      const grossWages = Math.round(payslip.grossEarned || 0);
      const basicAmount = Math.round(
        payslip.earnings?.find((e: any) => e.componentCode === "BASIC")?.amount || grossWages * 0.4
      );
      
      // Calculate PF Wages based on ceiling configuration
      const epfWages = restrictCeiling && wageCeiling > 0 ? Math.min(basicAmount, wageCeiling) : basicAmount;
      const epsWages = isEpsEnabled ? (restrictCeiling && wageCeiling > 0 ? Math.min(basicAmount, wageCeiling) : basicAmount) : 0;
      const edliWages = restrictCeiling && wageCeiling > 0 ? Math.min(basicAmount, wageCeiling) : basicAmount;

      // Employee share (e.g. 12% or 10%)
      const eeShare = Math.round(epfWages * eeRate);
      // EPS share (e.g. 8.33% capped at 1250)
      const epsShare = isEpsEnabled ? Math.round(Math.min(epsWages * epsRate, epsCap)) : 0;
      // Employer EPF share
      const erShare = Math.max(0, eeShare - epsShare);

      const ncpDays = Math.round(payslip.attendanceSummary?.unpaidLeaveDays || payslip.attendanceSummary?.absentDays || 0);
      const refund = 0;

      const record = [
        uan,
        name,
        grossWages,
        epfWages,
        epsWages,
        edliWages,
        eeShare,
        epsShare,
        erShare,
        ncpDays,
        refund,
      ].join("#~#");

      lines.push(record);
    }

    return lines.join("\n");
  }

  /**
   * Generates ESIC monthly return CSV data.
   */
  public static generateEsicReturnCsv(
    run: PayrollRunDocument,
    payslips: any[],
    customConfig?: Partial<PfEsiConfigDocument>
  ): string {
    if (customConfig && customConfig.isEsiEnabled === false) {
      return "";
    }

    const header = "IP Number,IP Name,No of Days for which wages paid,Total Monthly Wages,Reason Code for Zero wages,Last Working Day\n";
    const rows: string[] = [];

    for (const payslip of payslips) {
      const emp = payslip.employeeId || {};
      const esicNo = emp.identityDetails?.esicNo || "3100000000";
      const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
      const payableDays = payslip.attendanceSummary?.payableDays || 26;
      const gross = (payslip.grossEarned || 0).toFixed(2);

      rows.push(`"${esicNo}","${name}",${payableDays},${gross},,""`);
    }

    return header + rows.join("\n");
  }
}
