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

export class UnitedArabEmiratesPayrollStrategy implements ICountryPayrollStrategy {
  readonly countryCode = "AE";
  readonly defaultCurrency = "AED";

  async calculateStatutoryDeductions(
    input: StatutoryCalculationInput
  ): Promise<StatutoryCalculationResult> {
    const { basicMonthly } = input;
    const employeeDeductions: StatutoryLineItem[] = [];
    const employerContributions: StatutoryLineItem[] = [];

    // UAE has 0% Personal Income Tax for expats
    // UAE End of Service Gratuity Accrual Provision (21 days of basic pay per year of service for first 5 years)
    const monthlyGratuityProvision = Math.round(((basicMonthly * 21) / 30 / 12) * 100) / 100;

    if (monthlyGratuityProvision > 0) {
      employerContributions.push({
        code: "UAE_GRATUITY_EOSB",
        name: "UAE End of Service Gratuity (EOSB Accrual)",
        amount: monthlyGratuityProvision,
        isEmployerContribution: true,
      });
    }

    return {
      employeeDeductions,
      employerContributions,
      totalEmployeeStatutoryDeduction: 0,
      totalEmployerStatutoryCost: monthlyGratuityProvision,
      gratuityOrEndServiceProvision: monthlyGratuityProvision,
      taxRegimeOrBracket: "UAE_TAX_EXEMPT_0%",
      annualTaxableIncome: 0,
    };
  }

  async generateDisbursementFile(
    input: BankDisbursementInput
  ): Promise<DisbursementFileResult> {
    const { run, organization, items } = input;
    const validItems = items.filter((i) => i.hasValidBank && i.netPay > 0);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    // UAE Wages Protection System (WPS) SIF (Salary Information File) layout
    // Format: EDR,EmployeeID,AgentRoutingCode,AccountNumber,StartDate,EndDate,DaysCount,FixedSalary,VariableSalary,LeaveDays
    const employerMOLNumber = "1234567890123";
    const bankRoutingCode = "024"; // Example UAE Central Bank Routing Code
    const totalSalaries = validItems.reduce((sum, i) => sum + i.netPay, 0);

    const scrRecord = `SCR,${employerMOLNumber},${bankRoutingCode},${dateStr},${timeString()},${validItems.length},${totalSalaries.toFixed(2)},AED,SALARY ${run.month}/${run.year}`;

    const edrRows = validItems.map((i) => {
      return `EDR,${i.employeeCode},${i.ifscOrRoutingCode || "024"},${i.accountNumber},${run.year}-${String(run.month).padStart(2, "0")}-01,${run.year}-${String(run.month).padStart(2, "0")}-28,30,${i.netPay.toFixed(2)},0.00,0`;
    });

    return {
      filename: `${employerMOLNumber}${dateStr}.SIF`,
      contentType: "text/plain",
      content: [scrRecord, ...edrRows].join("\r\n"),
    };
  }

  async generateStatutoryReturn(
    input: StatutoryReturnInput
  ): Promise<StatutoryReturnResult> {
    const { run, payslips } = input;
    const headers = "Employee_ID,Labour_Card_Number,Gross_Salary_AED,Net_Salary_AED,EOSB_Provision_AED";
    const rows = payslips.map((p) => {
      return `${p.employeeId},LC-98765432,${p.grossEarned.toFixed(2)},${p.netPay.toFixed(2)},${(p.gratuityMonthlyProvision || 0).toFixed(2)}`;
    });

    return {
      filename: `UAE_MOHRE_WPS_Report_${run.year}_${run.month}.csv`,
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
      if (!emp.emiratesId && !emp.passportNo && !emp.pan) {
        warnings.push(`${emp.employeeCode} (${emp.firstName} ${emp.lastName}): Emirates ID or Passport number missing for WPS submission.`);
      }
    }

    return { criticalErrors, warnings };
  }
}

function timeString(): string {
  return new Date().toTimeString().slice(0, 5).replace(/:/g, "");
}
