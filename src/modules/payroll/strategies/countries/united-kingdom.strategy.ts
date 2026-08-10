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

export class UnitedKingdomPayrollStrategy implements ICountryPayrollStrategy {
  readonly countryCode = "GB";
  readonly defaultCurrency = "GBP";

  async calculateStatutoryDeductions(
    input: StatutoryCalculationInput
  ): Promise<StatutoryCalculationResult> {
    const { grossEarned } = input;
    const employeeDeductions: StatutoryLineItem[] = [];
    const employerContributions: StatutoryLineItem[] = [];

    // UK PAYE Income Tax & National Insurance (NI) Class 1
    // Primary threshold monthly ~£1,048 (12% up to UEL, 2% above)
    const niThreshold = 1048;
    const niEmployee = grossEarned > niThreshold ? Math.round((grossEarned - niThreshold) * 0.08 * 100) / 100 : 0;
    const niEmployer = grossEarned > 758 ? Math.round((grossEarned - 758) * 0.138 * 100) / 100 : 0;

    // PAYE Basic Rate 20% over standard personal allowance (£1,047/mo)
    const taxablePay = Math.max(0, grossEarned - 1047);
    const payeTax = Math.round(taxablePay * 0.20 * 100) / 100;

    if (niEmployee > 0) {
      employeeDeductions.push({ code: "NI_EE", name: "National Insurance (Employee)", amount: niEmployee });
    }
    if (payeTax > 0) {
      employeeDeductions.push({ code: "PAYE_TAX", name: "HMRC PAYE Income Tax", amount: payeTax });
    }

    if (niEmployer > 0) {
      employerContributions.push({
        code: "NI_ER",
        name: "Secondary National Insurance (Employer 13.8%)",
        amount: niEmployer,
        isEmployerContribution: true,
      });
    }

    const totalEmployeeStatutoryDeduction = employeeDeductions.reduce((sum, d) => sum + d.amount, 0);
    const totalEmployerStatutoryCost = employerContributions.reduce((sum, c) => sum + c.amount, 0);

    return {
      employeeDeductions,
      employerContributions,
      totalEmployeeStatutoryDeduction,
      totalEmployerStatutoryCost,
      gratuityOrEndServiceProvision: 0,
      taxRegimeOrBracket: "UK_PAYE_STANDARD",
      annualTaxableIncome: grossEarned * 12,
    };
  }

  async generateDisbursementFile(
    input: BankDisbursementInput
  ): Promise<DisbursementFileResult> {
    const { run, items } = input;
    const validItems = items.filter((i) => i.hasValidBank && i.netPay > 0);
    const headers = "Sort_Code,Account_Number,Transaction_Code,Amount_GBP,Employee_Name,Reference";
    const rows = validItems.map((i) => {
      return `${i.ifscOrRoutingCode || "00-00-00"},${i.accountNumber},99,${i.netPay.toFixed(2)},"${i.employeeName}","SALARY ${i.month}/${i.year}"`;
    });

    return {
      filename: `UK_BACS_Payment_Batch_${run.year}_${run.month}.csv`,
      contentType: "text/csv",
      content: [headers, ...rows].join("\r\n"),
    };
  }

  async generateStatutoryReturn(
    input: StatutoryReturnInput
  ): Promise<StatutoryReturnResult> {
    const { run, payslips } = input;
    const headers = "Employee_ID,NINO,Gross_Pay_GBP,Tax_Deducted_PAYE,Employee_NI,Employer_NI";
    const rows = payslips.map((p) => {
      return `${p.employeeId},QQ123456A,${p.grossEarned.toFixed(2)},${(p.tdsAmount || 0).toFixed(2)},${(p.pfEmployeeContribution || 0).toFixed(2)},${(p.pfEmployerContribution || 0).toFixed(2)}`;
    });

    return {
      filename: `HMRC_RTI_FPS_Return_${run.year}_${run.month}.csv`,
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
      if (!emp.nationalInsuranceNumber && !emp.pan) {
        warnings.push(`${emp.employeeCode} (${emp.firstName} ${emp.lastName}): UK National Insurance Number (NINO) missing.`);
      }
    }

    return { criticalErrors, warnings };
  }
}
