export interface StatutoryLineItem {
  code: string;
  name: string;
  amount: number;
  isEmployerContribution?: boolean;
}

export interface StatutoryCalculationInput {
  tenantId: string;
  branchId: string;
  employeeId: string;
  countryCode: string;
  currency: string;
  stateOrRegionCode?: string;
  month: number;
  year: number;
  financialYear: string;
  monthsRemainingInFY: number;
  payableDays: number;
  totalDaysInMonth: number;
  grossEarned: number;
  wagesForStatutory: number;
  annualCtc: number;
  basicMonthly: number;
  hraMonthly: number;
  employee: any;
  statutoryFlags: {
    pfEnabled?: boolean;
    esiEnabled?: boolean;
    ptEnabled?: boolean;
    tdsEnabled?: boolean;
    lwfEnabled?: boolean;
    ficaEnabled?: boolean;
    payeEnabled?: boolean;
    wpsEnabled?: boolean;
    [key: string]: boolean | undefined;
  };
  hasPrecedingContributions?: boolean;
}

export interface StatutoryCalculationResult {
  employeeDeductions: StatutoryLineItem[];
  employerContributions: StatutoryLineItem[];
  totalEmployeeStatutoryDeduction: number;
  totalEmployerStatutoryCost: number;
  gratuityOrEndServiceProvision: number;
  taxRegimeOrBracket?: string;
  annualTaxableIncome?: number;
  metadata?: Record<string, any>;
}

export interface BankDisbursementInput {
  run: any;
  organization: any;
  items: Array<{
    payslipId: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    email: string;
    phone: string;
    bankName: string;
    accountNumber: string;
    ifscOrRoutingCode: string;
    accountType: string;
    netPay: number;
    currency: string;
    month: number;
    year: number;
    narration: string;
    hasValidBank: boolean;
  }>;
  format?: string;
}

export interface DisbursementFileResult {
  filename: string;
  contentType: string;
  content: string;
}

export interface StatutoryReturnInput {
  run: any;
  payslips: any[];
  empMap: Map<string, any>;
  branch: any;
  organization: any;
  returnType?: string;
}

export interface StatutoryReturnResult {
  filename: string;
  contentType: string;
  recordCount: number;
  content: string;
  data?: any;
}

export interface ValidationReport {
  criticalErrors: string[];
  warnings: string[];
}

export interface ICountryPayrollStrategy {
  readonly countryCode: string; // ISO 2-letter e.g. "IN", "US", "GB", "AE", "SG"
  readonly defaultCurrency: string; // ISO 3-letter e.g. "INR", "USD", "GBP", "AED", "SGD"

  // Core statutory calculations
  calculateStatutoryDeductions(input: StatutoryCalculationInput): Promise<StatutoryCalculationResult>;

  // Bank disbursement generator
  generateDisbursementFile(input: BankDisbursementInput): Promise<DisbursementFileResult>;

  // Statutory return generator
  generateStatutoryReturn(input: StatutoryReturnInput): Promise<StatutoryReturnResult>;

  // Pre-flight profile validation
  validatePreFlightProfiles(employees: any[], branch: any, period: string): Promise<ValidationReport>;
}
