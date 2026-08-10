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

export class UnitedStatesPayrollStrategy implements ICountryPayrollStrategy {
  readonly countryCode = "US";
  readonly defaultCurrency = "USD";

  async calculateStatutoryDeductions(
    input: StatutoryCalculationInput
  ): Promise<StatutoryCalculationResult> {
    const { grossEarned } = input;
    const employeeDeductions: StatutoryLineItem[] = [];
    const employerContributions: StatutoryLineItem[] = [];

    // FICA: Social Security (6.2% up to annual cap) & Medicare (1.45%)
    const socialSecurityEE = Math.round(grossEarned * 0.062 * 100) / 100;
    const socialSecurityER = Math.round(grossEarned * 0.062 * 100) / 100;
    const medicareEE = Math.round(grossEarned * 0.0145 * 100) / 100;
    const medicareER = Math.round(grossEarned * 0.0145 * 100) / 100;

    // Federal Income Tax Withholding (W-4 progressive estimate e.g. 10% effective)
    const federalWithholding = Math.round(grossEarned * 0.10 * 100) / 100;

    employeeDeductions.push(
      { code: "SOC_SEC_EE", name: "Social Security (FICA 6.2%)", amount: socialSecurityEE },
      { code: "MEDICARE_EE", name: "Medicare (1.45%)", amount: medicareEE },
      { code: "FIT_W4", name: "Federal Income Tax Withholding", amount: federalWithholding }
    );

    employerContributions.push(
      { code: "SOC_SEC_ER", name: "Employer Social Security Match (6.2%)", amount: socialSecurityER, isEmployerContribution: true },
      { code: "MEDICARE_ER", name: "Employer Medicare Match (1.45%)", amount: medicareER, isEmployerContribution: true },
      { code: "FUTA_ER", name: "Federal Unemployment Tax (FUTA 0.6%)", amount: Math.round(grossEarned * 0.006 * 100) / 100, isEmployerContribution: true }
    );

    const totalEmployeeStatutoryDeduction = employeeDeductions.reduce((sum, d) => sum + d.amount, 0);
    const totalEmployerStatutoryCost = employerContributions.reduce((sum, c) => sum + c.amount, 0);

    return {
      employeeDeductions,
      employerContributions,
      totalEmployeeStatutoryDeduction,
      totalEmployerStatutoryCost,
      gratuityOrEndServiceProvision: 0,
      taxRegimeOrBracket: "US_FEDERAL_W4",
      annualTaxableIncome: grossEarned * 12,
    };
  }

  async generateDisbursementFile(
    input: BankDisbursementInput
  ): Promise<DisbursementFileResult> {
    const { run, organization, items } = input;
    const validItems = items.filter((i) => i.hasValidBank && i.netPay > 0);
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, "");
    const companyName = (organization?.companyName || "US COMPANY").padEnd(16).slice(0, 16);
    const compId = "1234567890".padEnd(10).slice(0, 10);

    // NACHA ACH 94-byte fixed format
    const fileHeader = `101 123456789 ${compId}${dateStr}${timeStr}A09410${companyName.padEnd(23)}ADVANCED HRMS   `;
    const batchHeader = `5200${companyName}                    ${compId}PPDDIRECT PAY${dateStr}${dateStr}   1012345670000001`;

    let entrySeq = 0;
    let totalCents = 0;
    const entries: string[] = [];

    for (const item of validItems) {
      entrySeq++;
      const cents = Math.round(item.netPay * 100);
      totalCents += cents;
      const routing = (item.ifscOrRoutingCode || "12345678").padEnd(8, "0").slice(0, 8);
      const dfaAccount = item.accountNumber.padEnd(17).slice(0, 17);
      const amtStr = String(cents).padStart(10, "0");
      const indId = item.employeeCode.padEnd(15).slice(0, 15);
      const indName = item.employeeName.padEnd(22).slice(0, 22);
      const traceNo = `01234567${String(entrySeq).padStart(7, "0")}`;

      entries.push(`622${routing}0${dfaAccount}${amtStr}${indId}${indName}  0${traceNo}`);
    }

    const entryCountStr = String(entrySeq).padStart(6, "0");
    const totalAmtStr = String(totalCents).padStart(12, "0");
    const batchControl = `8200${entryCountStr}0000000000000000${totalAmtStr}${compId}                         012345670000001`;
    const totalRecords = 1 + 1 + entrySeq + 1 + 1;
    const blockCount = Math.ceil(totalRecords / 10);
    const fileControl = `9000001${String(blockCount).padStart(6, "0")}${entryCountStr}0000000000000000${totalAmtStr}                                       `;

    return {
      filename: `US_ACH_Direct_Deposit_${run.year}_${run.month}_${dateStr}.ach`,
      contentType: "text/plain",
      content: [fileHeader, batchHeader, ...entries, batchControl, fileControl].join("\r\n"),
    };
  }

  async generateStatutoryReturn(
    input: StatutoryReturnInput
  ): Promise<StatutoryReturnResult> {
    const { run, payslips } = input;
    const headers = "Employee_ID,SSN_Last4,Gross_Wages_USD,Federal_Withholding,Social_Security_EE,Medicare_EE,Employer_FICA_Match";
    const rows = payslips.map((p) => {
      const gross = p.grossEarned || 0;
      return `${p.employeeId},XXXX,${gross.toFixed(2)},${(gross * 0.1).toFixed(2)},${(gross * 0.062).toFixed(2)},${(gross * 0.0145).toFixed(2)},${(gross * 0.0765).toFixed(2)}`;
    });

    return {
      filename: `US_IRS_Form941_Quarterly_Data_${run.year}_${run.month}.csv`,
      contentType: "text/csv",
      recordCount: payslips.length,
      content: [headers, ...rows].join("\r\n"),
    };
  }

  async validatePreFlightProfiles(
    employees: any[],
    branch: any,
    period: string
  ): Promise<ValidationReport> {
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    for (const emp of employees) {
      if (!emp.taxId && !emp.pan) {
        warnings.push(`${emp.employeeCode} (${emp.firstName} ${emp.lastName}): SSN / ITIN is missing.`);
      }
    }

    return { criticalErrors, warnings };
  }
}
