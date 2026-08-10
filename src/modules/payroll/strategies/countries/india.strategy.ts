import {
  ICountryPayrollStrategy,
  StatutoryCalculationInput,
  StatutoryCalculationResult,
  BankDisbursementInput,
  DisbursementFileResult,
  StatutoryReturnInput,
  StatutoryReturnResult,
  ValidationReport,
  StatutoryLineItem,
} from "../country-payroll.interface";
import {
  calculatePF,
  calculateESI,
  calculatePT,
  calculateLWF,
  calculateTDS,
  calculateMonthlyGratuityProvision,
} from "../../services/payroll-engine.service";

export class IndiaPayrollStrategy implements ICountryPayrollStrategy {
  readonly countryCode = "IN";
  readonly defaultCurrency = "INR";

  async calculateStatutoryDeductions(
    input: StatutoryCalculationInput
  ): Promise<StatutoryCalculationResult> {
    const {
      tenantId,
      stateOrRegionCode = "",
      month,
      financialYear,
      monthsRemainingInFY,
      payableDays,
      totalDaysInMonth,
      grossEarned,
      wagesForStatutory,
      annualCtc,
      basicMonthly,
      hraMonthly,
      employee,
      statutoryFlags,
      hasPrecedingContributions,
    } = input;

    const employeeDeductions: StatutoryLineItem[] = [];
    const employerContributions: StatutoryLineItem[] = [];

    // 1. ESIC Calculation (with contribution cycle rule)
    const bypassCeiling = !!hasPrecedingContributions && grossEarned > 21000;
    const esi = calculateESI(
      grossEarned,
      !!statutoryFlags.esiEnabled,
      "IN",
      bypassCeiling
    );

    if (esi.employee > 0) {
      employeeDeductions.push({
        code: "ESI",
        name: "Employee State Insurance (Employee)",
        amount: esi.employee,
      });
    }
    if (esi.employer > 0) {
      employerContributions.push({
        code: "ESI_ER",
        name: "Employee State Insurance (Employer)",
        amount: esi.employer,
        isEmployerContribution: true,
      });
    }

    // 2. Provident Fund (PF) Calculation
    const wagesRatio = totalDaysInMonth > 0 ? payableDays / totalDaysInMonth : 1;
    const proRatedWages = Math.round(wagesForStatutory * wagesRatio);
    const pf = calculatePF(
      proRatedWages,
      !!statutoryFlags.pfEnabled,
      "IN",
      !!employee.pfOnActuals
    );

    if (pf.employee > 0) {
      employeeDeductions.push({
        code: "PF",
        name: "Provident Fund (Employee EPF)",
        amount: pf.employee,
      });
    }
    if (pf.totalEmployer > 0) {
      employerContributions.push({
        code: "PF_ER",
        name: "Provident Fund (Employer EPF + EPS + EDLI + Admin)",
        amount: pf.totalEmployer,
        isEmployerContribution: true,
      });
    }

    // 3. Professional Tax (PT)
    const pt = await calculatePT(
      tenantId,
      grossEarned,
      stateOrRegionCode,
      !!statutoryFlags.ptEnabled,
      financialYear
    );

    if (pt > 0) {
      employeeDeductions.push({
        code: "PT",
        name: "Professional Tax",
        amount: pt,
      });
    }

    // 4. Labour Welfare Fund (LWF)
    const lwf = await calculateLWF(
      tenantId,
      stateOrRegionCode,
      month,
      financialYear,
      !!statutoryFlags.lwfEnabled
    );

    if (lwf.employee > 0) {
      employeeDeductions.push({
        code: "LWF",
        name: "Labour Welfare Fund (Employee)",
        amount: lwf.employee,
      });
    }
    if (lwf.employer > 0) {
      employerContributions.push({
        code: "LWF_ER",
        name: "Labour Welfare Fund (Employer)",
        amount: lwf.employer,
        isEmployerContribution: true,
      });
    }

    // 5. Income Tax TDS (11-Step Engine or 20% flat Sec 206AA rate)
    let tdsResult;
    const pfEmployeeAnnual = pf.employee * 12;

    if (!employee.pan) {
      const flatTDS = Math.round(grossEarned * 0.2);
      tdsResult = {
        annualTaxableIncome: grossEarned * 12,
        annualTax: flatTDS * 12,
        annualTaxWithCess: flatTDS * 12,
        monthlyTDS: flatTDS,
        regime: "NEW" as any,
      };
    } else {
      tdsResult = await calculateTDS(
        tenantId,
        (employee._id || employee.id).toString(),
        annualCtc,
        basicMonthly,
        hraMonthly,
        pfEmployeeAnnual,
        financialYear,
        !!statutoryFlags.tdsEnabled,
        monthsRemainingInFY
      );
    }

    if (tdsResult.monthlyTDS > 0) {
      employeeDeductions.push({
        code: "TDS",
        name: "Tax Deducted at Source (TDS)",
        amount: tdsResult.monthlyTDS,
      });
    }

    // 6. Gratuity Provision Accrual
    const gratuityProvision = calculateMonthlyGratuityProvision(basicMonthly);
    if (gratuityProvision > 0) {
      employerContributions.push({
        code: "GRATUITY_PROVISION",
        name: "Gratuity Monthly Accrual Provision",
        amount: gratuityProvision,
        isEmployerContribution: true,
      });
    }

    const totalEmployeeStatutoryDeduction = employeeDeductions.reduce(
      (sum, d) => sum + d.amount,
      0
    );
    const totalEmployerStatutoryCost = employerContributions.reduce(
      (sum, c) => sum + c.amount,
      0
    );

    return {
      employeeDeductions,
      employerContributions,
      totalEmployeeStatutoryDeduction,
      totalEmployerStatutoryCost,
      gratuityOrEndServiceProvision: gratuityProvision,
      taxRegimeOrBracket: tdsResult.regime,
      annualTaxableIncome: tdsResult.annualTaxableIncome,
      metadata: {
        pfEmployee: pf.employee,
        pfEmployer: pf.totalEmployer,
        esiEmployee: esi.employee,
        esiEmployer: esi.employer,
        ptAmount: pt,
        lwfEmployee: lwf.employee,
        lwfEmployer: lwf.employer,
        tdsAmount: tdsResult.monthlyTDS,
      },
    };
  }

  async generateDisbursementFile(
    input: BankDisbursementInput
  ): Promise<DisbursementFileResult> {
    const { run, items, format = "GENERIC_CSV" } = input;
    const validItems = items.filter((i) => i.hasValidBank && i.netPay > 0);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    if (format === "HDFC_CMS") {
      const headers =
        "Transaction_Type|Beneficiary_Code|Account_Number|Amount|Beneficiary_Name|Customer_Ref_No|IFSC_Code|Email|Narration";
      const rows = validItems.map((i) => {
        const txType = i.ifscOrRoutingCode.toUpperCase().startsWith("HDFC")
          ? "I"
          : "N";
        return `${txType}|${i.employeeCode}|${i.accountNumber}|${i.netPay.toFixed(
          2
        )}|${i.employeeName}|${run.runLabel}-${i.employeeCode}|${i.ifscOrRoutingCode
          }|${i.email}|Salary-${i.month}-${i.year}`;
      });
      return {
        filename: `HDFC_CMS_Payout_${run.year}_${run.month}_${dateStr}.txt`,
        contentType: "text/plain",
        content: [headers, ...rows].join("\r\n"),
      };
    }

    if (format === "ICICI_CMS") {
      const headers =
        "Payment_Mode,Beneficiary_Name,Account_Number,Amount,IFSC_Code,Employee_Code,Narration";
      const rows = validItems.map((i) => {
        const mode = i.ifscOrRoutingCode.toUpperCase().startsWith("ICIC")
          ? "FT"
          : "NEFT";
        return `${mode},"${i.employeeName.replace(/"/g, '""')}",${i.accountNumber
          },${i.netPay.toFixed(2)},${i.ifscOrRoutingCode},${i.employeeCode
          },"Salary for ${i.month}/${i.year}"`;
      });
      return {
        filename: `ICICI_Salary_Payout_${run.year}_${run.month}_${dateStr}.csv`,
        contentType: "text/csv",
        content: [headers, ...rows].join("\r\n"),
      };
    }

    if (format === "SBI_DIRECT") {
      const headers =
        "Account_Number,Amount,Employee_Name,Narration,Transaction_Reference";
      const rows = validItems.map((i) => {
        return `${i.accountNumber},${i.netPay.toFixed(
          2
        )},"${i.employeeName.replace(/"/g, '""')}","Salary ${i.month}/${i.year
          }",${run._id?.toString().slice(-8)}-${i.employeeCode}`;
      });
      return {
        filename: `SBI_Salary_Batch_${run.year}_${run.month}_${dateStr}.csv`,
        contentType: "text/csv",
        content: [headers, ...rows].join("\r\n"),
      };
    }

    // Default Generic CSV
    const headers =
      "Employee_Code,Employee_Name,Email,Phone,Bank_Name,Account_Number,IFSC_Code,Account_Type,Net_Pay,Currency,Payment_Month,Payment_Year,Narration";
    const rows = validItems.map((i) => {
      return `${i.employeeCode},"${i.employeeName.replace(/"/g, '""')}",${i.email
        },${i.phone},"${i.bankName.replace(/"/g, '""')}",'${i.accountNumber
        }',${i.ifscOrRoutingCode},${i.accountType},${i.netPay.toFixed(2)},${i.currency || "INR"
        },${i.month},${i.year},"${i.narration}"`;
    });

    return {
      filename: `Bank_Disbursement_IN_${run.year}_${run.month}_${dateStr}.csv`,
      contentType: "text/csv",
      content: [headers, ...rows].join("\r\n"),
    };
  }

  async generateStatutoryReturn(
    input: StatutoryReturnInput
  ): Promise<StatutoryReturnResult> {
    const { run, payslips, empMap, returnType = "EPF_ECR" } = input;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    if (returnType === "ESIC") {
      const esiPayslips = payslips.filter(
        (p) => (p.esiEmployeeContribution || 0) > 0
      );
      const headers =
        "IP_Number,IP_Name,No_Of_Days_Wages_Paid,Total_Monthly_Wages,IP_Contribution,Reason_Code";
      const rows = esiPayslips.map((p) => {
        const emp = empMap.get(p.employeeId.toString());
        const ipName = emp
          ? `${emp.firstName} ${emp.lastName}`.trim()
          : "EMPLOYEE";
        const ipNumber = emp?.employeeCode || "0000000000";
        const payableDays = p.attendanceSummary?.payableDays || 0;
        const grossWages = Math.round(p.grossEarned);
        const ipContribution = p.esiEmployeeContribution || 0;
        const reasonCode = payableDays === 0 ? "1" : "0";
        return `${ipNumber},"${ipName.replace(
          /"/g,
          '""'
        )}",${payableDays},${grossWages},${ipContribution},${reasonCode}`;
      });

      return {
        filename: `ESIC_Monthly_Return_${run.year}_${run.month}_${dateStr}.csv`,
        contentType: "text/csv",
        recordCount: esiPayslips.length,
        content: [headers, ...rows].join("\r\n"),
      };
    }

    if (returnType === "TDS_24Q") {
      const headers =
        "Employee_Code,Employee_Name,PAN_Number,Gross_Earnings,Taxable_Income,TDS_Deducted,Tax_Regime";
      const rows = payslips.map((p) => {
        const emp = empMap.get(p.employeeId.toString());
        const pan = emp?.pan || "PANNOTAVBL";
        const name = emp
          ? `${emp.firstName} ${emp.lastName}`.trim()
          : "Unknown";
        return `${emp?.employeeCode || "N/A"},"${name.replace(
          /"/g,
          '""'
        )}",${pan},${p.grossEarned.toFixed(2)},${(
          p.annualTaxableIncome || 0
        ).toFixed(2)},${(p.tdsAmount || 0).toFixed(2)},${p.taxRegime || "NEW"
          }`;
      });

      return {
        filename: `TDS_Form24Q_${run.year}_${run.month}_${dateStr}.csv`,
        contentType: "text/csv",
        recordCount: payslips.length,
        content: [headers, ...rows].join("\r\n"),
      };
    }

    // Default EPFO ECR text format
    const pfPayslips = payslips.filter(
      (p) => (p.pfEmployeeContribution || 0) > 0
    );
    const rows = pfPayslips.map((p) => {
      const emp = empMap.get(p.employeeId.toString());
      const memberName = emp
        ? `${emp.firstName} ${emp.lastName}`.trim().toUpperCase()
        : "EMPLOYEE";
      const uan = emp?.employeeCode || "100000000000";
      const grossWages = Math.round(p.grossEarned);
      const epfWages = emp?.pfOnActuals
        ? grossWages
        : Math.min(15000, grossWages);
      const epsWages = Math.min(15000, epfWages);
      const edliWages = epsWages;
      const eeShare =
        p.pfEmployeeContribution || Math.round(epfWages * 0.12);
      const epsShare = Math.min(1250, Math.round(epsWages * 0.0833));
      const erEpfShare = Math.max(
        0,
        (p.pfEmployerContribution || Math.round(epfWages * 0.12)) - epsShare
      );
      const ncpDays =
        (p.attendanceSummary?.absentDays || 0) +
        (p.attendanceSummary?.unpaidLeaveDays || 0);
      const refundOfAdvances = 0;

      return `${uan}#~#${memberName}#~#${grossWages}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${eeShare}#~#${epsShare}#~#${erEpfShare}#~#${ncpDays}#~#${refundOfAdvances}`;
    });

    return {
      filename: `EPFO_ECR_${run.year}_${run.month}_${dateStr}.txt`,
      contentType: "text/plain",
      recordCount: pfPayslips.length,
      content: rows.join("\r\n"),
    };
  }

  async validatePreFlightProfiles(
    employees: any[],
    branch: any,
    period: string
  ): Promise<ValidationReport> {
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    if (!branch?.address?.state && !branch?.stateOrRegionCode) {
      warnings.push(
        `Branch "${branch?.name || "Branch"}" has no State Code configured. Professional Tax and LWF will calculate as 0.`
      );
    }

    for (const emp of employees) {
      const label = `${emp.employeeCode} (${emp.firstName} ${emp.lastName})`;
      if (!emp.pan) {
        warnings.push(
          `${label}: PAN is missing. TDS will be deducted at flat 20% penalty rate (Section 206AA).`
        );
      }
    }

    return { criticalErrors, warnings };
  }
}
