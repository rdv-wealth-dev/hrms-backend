import mongoose from "mongoose";
import { AttendanceModel } from "../attendance/core/attendance.model";
import { LeaveRequestModel, LeaveRequestStatus } from "../leave/leave-requests/leave-request.model";
import { LeaveTypeModel } from "../leave/leave-types/leave-type.model";
import { SalaryLineItem } from "./salary-structures/salary-structure.model";
import { AttendanceSummarySnapshot, PayslipEarning } from "./payslip/payslip.model";
import { ProfessionalTaxConfigModel } from "./statutory-config.model";
import { LWFConfigModel } from "./statutory-config.model";
import { TaxDeclarationModel, TaxRegime } from "./statutory-config.model";
import { OvertimeModel, OTStatus } from "./overtime.model";
import { AttendanceLockModel, AttendanceLockStatus } from "../attendance/core/attendance-lock.model";
import { getCountryModule } from "../../core/plugins/country-registry";

// CONSTANTS

const PF_EMPLOYEE_RATE     = 0.12;
const PF_EMPLOYER_EPF_RATE = 0.0367;  // 3.67% → EPF account
const PF_EPS_RATE          = 0.0833;  // 8.33% → EPS pension
const PF_ADMIN_RATE        = 0.005;   // 0.50% admin charge
const PF_EDLI_RATE         = 0.005;   // 0.50% EDLI insurance
const PF_WAGE_CEILING      = 15_000;  // statutory ceiling
const EPS_CAP              = 1_250;   // ₹15,000 × 8.33% = ₹1,250 max

const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;
const ESI_WAGE_CEILING  = 21_000;

// ATTENDANCE LOCK ASSERTION
// Called at the start of generatePayslips — hard stop if not locked

export async function assertAttendanceLocked(
  tenantId: string,
  branchId: string,
  year:     number,
  month:    number
): Promise<void> {
  const period = `${year}-${String(month).padStart(2, "0")}`;

  const lock = await AttendanceLockModel.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    branchId: new mongoose.Types.ObjectId(branchId),
    period,
  }).lean();

  if (!lock || lock.status !== AttendanceLockStatus.LOCKED) {
    throw new Error(
      `Attendance for ${period} is not locked. ` +
      `Lock attendance before running payroll.`
    );
  }
}

// BUILD ATTENDANCE SUMMARY
// Fixed the N+1 bug: bulk-fetch ALL leave requests + types ONCE,
// then do O(1) map lookups per attendance record.

export async function buildAttendanceSummary(
  tenantId:   string,
  employeeId: string,
  year:       number,
  month:      number
): Promise<AttendanceSummarySnapshot> {

  const fromDate         = new Date(year, month - 1, 1);
  const toDate           = new Date(year, month, 0, 23, 59, 59);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const tenantOid   = new mongoose.Types.ObjectId(tenantId);
  const employeeOid = new mongoose.Types.ObjectId(employeeId);

  // ── 1. Fetch all attendance records for this employee this month 
  const records = await AttendanceModel.find({
    tenantId:       tenantOid,
    employeeId:     employeeOid,
    attendanceDate: { $gte: fromDate, $lte: toDate },
    isDeleted:      false,
  }).lean();

  // ── 2. Bulk-fetch ALL approved leave requests covering this month 
  // Single query replaces per-record queries — eliminates N+1
  const leaveRequests = await LeaveRequestModel.find({
    tenantId:   tenantOid,
    employeeId: employeeOid,
    status:     LeaveRequestStatus.APPROVED,
    fromDate:   { $lte: toDate   },
    toDate:     { $gte: fromDate },
    isDeleted:  false,
  }).select("leaveTypeId fromDate toDate").lean();

  // ── 3. Bulk-fetch all referenced leave types in one query 
  const leaveTypeIds = [
    ...new Set(leaveRequests.map((lr) => lr.leaveTypeId.toString())),
  ];

  const leaveTypes = leaveTypeIds.length
    ? await LeaveTypeModel.find({
        _id: { $in: leaveTypeIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("isPaid")
        .lean()
    : [];

  const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt._id.toString(), lt]));

  // ── 4. Expand each leave request into individual date keys 
  // O(1) lookup: "is this date a paid leave day?"
  const leaveDayMap = new Map<string, { isPaid: boolean }>();

  for (const lr of leaveRequests) {
    const lt = leaveTypeMap.get(lr.leaveTypeId.toString());
    if (!lt) continue;

    const cursor = new Date(lr.fromDate);
    const end    = new Date(lr.toDate);

    while (cursor <= end) {
      leaveDayMap.set(cursor.toISOString().slice(0, 10), {
        isPaid: lt.isPaid,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // ── 5. Build summary
  const summary: AttendanceSummarySnapshot = {
    totalDaysInMonth,
    presentDays:    0,
    lateDays:       0,
    halfDays:       0,
    absentDays:     0,
    onLeaveDays:    0,
    paidLeaveDays:  0,
    unpaidLeaveDays: 0,
    holidayDays:    0,
    weekOffDays:    0,
    payableDays:    0,
  };

  for (const r of records) {
    const dateKey = (r.attendanceDate as Date).toISOString().slice(0, 10);

    switch (r.status) {
      case "PRESENT":  summary.presentDays++;  break;
      case "LATE":     summary.lateDays++;     break;
      case "HALF_DAY": summary.halfDays++;     break;
      case "ABSENT":   summary.absentDays++;   break;
      case "HOLIDAY":  summary.holidayDays++;  break;
      case "WEEK_OFF": summary.weekOffDays++;  break;

      case "ON_LEAVE": {
        summary.onLeaveDays++;
        const leaveInfo = leaveDayMap.get(dateKey);

        if (leaveInfo?.isPaid === true) {
          summary.paidLeaveDays++;
        } else if (leaveInfo?.isPaid === false) {
          summary.unpaidLeaveDays++;
        } else {
          // ON_LEAVE with no traceable approved request
          // Conservative default: treat as paid (benefit of doubt to employee)
          summary.paidLeaveDays++;
        }
        break;
      }
    }
  }

  // ── 6. Unaccounted days guard
  // If attendance closeout job missed days, treat as absent (payroll safety)
  const accountedDays =
    summary.presentDays +
    summary.lateDays +
    summary.halfDays +
    summary.absentDays +
    summary.onLeaveDays +
    summary.holidayDays +
    summary.weekOffDays;

  const unaccountedDays = Math.max(0, totalDaysInMonth - accountedDays);
  summary.absentDays += unaccountedDays;

  // ── 7. Payable days formula
  // Present + Late (worked the day, just late) + Half days (×0.5)
  // + Paid leave + Holidays + Week offs
  // Absent + Unpaid leave = LOP → NOT included in payable days
  summary.payableDays = Math.min(
    summary.presentDays +
    summary.lateDays +
    summary.halfDays * 0.5 +
    summary.paidLeaveDays +
    summary.holidayDays +
    summary.weekOffDays,
    totalDaysInMonth
  );

  return summary;
}

// PRO-RATE EARNINGS

export function proRateEarnings(
  lineItems:        SalaryLineItem[],
  payableDays:      number,
  totalDaysInMonth: number
): PayslipEarning[] {
  const ratio =
    totalDaysInMonth > 0
      ? Math.min(payableDays / totalDaysInMonth, 1)
      : 1;

  return lineItems.map((item) => ({
    componentCode: item.componentCode,
    componentName: item.componentCode, // resolved to display name at service layer
    amount:        Math.round(item.amount * ratio * 100) / 100,
  }));
}

// PF — EPF Act 1952
// Returns full breakdown: employee + EPF + EPS + admin + EDLI

export function calculatePF(
  wagesForStatutory: number,
  pfEnabled:         boolean,
  countryCode:       string = "IN"
): {
  employee:      number;
  employerEPF:   number;
  employerEPS:   number;
  adminCharge:   number;
  edliCharge:    number;
  totalEmployer: number;
} {
  const module = getCountryModule(countryCode);
  if (module.calculatePF) {
    return module.calculatePF(wagesForStatutory, pfEnabled);
  }
  return {
    employee: 0, employerEPF: 0, employerEPS: 0,
    adminCharge: 0, edliCharge: 0, totalEmployer: 0,
  };
}

// ESIC — ESI Act 1948

export function calculateESI(
  grossMonthly: number,
  esiEnabled:   boolean,
  countryCode:  string = "IN"
): { employee: number; employer: number } {
  const module = getCountryModule(countryCode);
  if (module.calculateESI) {
    return module.calculateESI(grossMonthly, esiEnabled);
  }
  return { employee: 0, employer: 0 };
}

// PROFESSIONAL TAX — DB-driven state slabs
// HR manages slabs via /api/v1/payroll/statutory/pt
// Returns 0 if no config found for state (Delhi, Gujarat, UP, MP etc.)

export async function calculatePT(
  tenantId:      string,
  grossMonthly:  number,
  stateCode:     string,
  ptEnabled:     boolean,
  financialYear: string
): Promise<number> {
  if (!ptEnabled || grossMonthly <= 0 || !stateCode) return 0;

  const config = await ProfessionalTaxConfigModel.findOne({
    tenantId:      new mongoose.Types.ObjectId(tenantId),
    stateCode:     stateCode.toUpperCase(),
    financialYear,
    isActive:      true,
    isDeleted:     false,
  }).lean();

  if (!config || !config.slabs?.length) return 0;

  // maxSalary 0 = no upper limit (top slab)
  const slab = config.slabs.find(
    (s: any) =>
      grossMonthly >= s.minSalary &&
      (s.maxSalary === 0 || grossMonthly <= s.maxSalary)
  );

  return slab?.ptAmount ?? 0;
}

// LWF — Labour Welfare Fund
// Deducted only in months HR configures (typically June + December)

export async function calculateLWF(
  tenantId:      string,
  stateCode:     string,
  month:         number,
  financialYear: string,
  lwfEnabled:    boolean
): Promise<{ employee: number; employer: number }> {
  const zero = { employee: 0, employer: 0 };
  if (!lwfEnabled || !stateCode) return zero;

  const config = await LWFConfigModel.findOne({
    tenantId:      new mongoose.Types.ObjectId(tenantId),
    stateCode:     stateCode.toUpperCase(),
    financialYear,
    isActive:      true,
    isDeleted:     false,
  }).lean();

  if (!config) return zero;
  if (!config.deductionMonths.includes(month)) return zero;

  return {
    employee: config.employeeContribution,
    employer: config.employerContribution,
  };
}

// TDS / INCOME TAX — full 12-step engine
// Old regime: HRA exemption + 80C/80D/80CCD/home loan + standard deduction
// New regime: standard deduction only (₹75,000 FY2024-25)
// Monthly TDS = remaining annual liability / months remaining in FY

const NEW_REGIME_SLABS = [
  { min: 0,          max: 300_000,    rate: 0.00 },
  { min: 300_001,    max: 600_000,    rate: 0.05 },
  { min: 600_001,    max: 900_000,    rate: 0.10 },
  { min: 900_001,    max: 1_200_000,  rate: 0.15 },
  { min: 1_200_001,  max: 1_500_000,  rate: 0.20 },
  { min: 1_500_001,  max: Infinity,   rate: 0.30 },
];

const OLD_REGIME_SLABS = [
  { min: 0,          max: 250_000,    rate: 0.00 },
  { min: 250_001,    max: 500_000,    rate: 0.05 },
  { min: 500_001,    max: 1_000_000,  rate: 0.20 },
  { min: 1_000_001,  max: Infinity,   rate: 0.30 },
];

function computeSlabTax(
  taxableIncome: number,
  slabs: { min: number; max: number; rate: number }[]
): number {
  let tax = 0;
  for (const slab of slabs) {
    if (taxableIncome <= slab.min) continue;
    const taxableInSlab = Math.min(taxableIncome, slab.max) - slab.min;
    tax += taxableInSlab * slab.rate;
  }
  return Math.round(tax);
}

function computeSurcharge(taxableIncome: number, tax: number): number {
  if (taxableIncome > 10_000_000) return Math.round(tax * 0.15);
  if (taxableIncome > 5_000_000)  return Math.round(tax * 0.10);
  return 0;
}

function computeHRAExemption(
  basicMonthly:    number,
  hraReceived:     number,
  rentPaidMonthly: number,
  isMetro:         boolean
): number {
  if (rentPaidMonthly <= 0) return 0;

  const annualBasic = basicMonthly * 12;
  const annualHRA   = hraReceived  * 12;
  const annualRent  = rentPaidMonthly * 12;

  const c1 = annualHRA;
  const c2 = isMetro ? annualBasic * 0.5 : annualBasic * 0.4;
  const c3 = Math.max(0, annualRent - annualBasic * 0.1);

  return Math.min(c1, c2, c3);
}

export interface TDSResult {
  annualTaxableIncome: number;
  annualTax:           number;
  annualTaxWithCess:   number;
  monthlyTDS:          number;
  regime:              TaxRegime;
}

export async function calculateTDS(
  tenantId:          string,
  employeeId:        string,
  annualCtc:         number,
  basicMonthly:      number,
  hraMonthly:        number,
  pfEmployeeAnnual:  number,
  financialYear:     string,
  tdsEnabled:        boolean,
  monthsRemaining:   number
): Promise<TDSResult> {
  const zero: TDSResult = {
    annualTaxableIncome: 0,
    annualTax:           0,
    annualTaxWithCess:   0,
    monthlyTDS:          0,
    regime:              TaxRegime.NEW,
  };

  if (!tdsEnabled || annualCtc <= 0) return zero;

  // ── Fetch employee tax declaration 
  const declaration = await TaxDeclarationModel.findOne({
    tenantId:      new mongoose.Types.ObjectId(tenantId),
    employeeId:    new mongoose.Types.ObjectId(employeeId),
    financialYear,
    isDeleted:     false,
  }).lean();

  const regime = declaration?.regime ?? TaxRegime.NEW;

  // ── STEP 1: Start with annual CTC as gross income 
  let taxableIncome = annualCtc;

  // ── STEP 2: Old regime exemptions
  if (regime === TaxRegime.OLD && declaration) {
    const hraExemption = computeHRAExemption(
      basicMonthly,
      hraMonthly,
      declaration.rentPaidMonthly ?? 0,
      declaration.isMetroCity     ?? false
    );
    taxableIncome -= hraExemption;
    taxableIncome -= 19_200;  // Conveyance ₹1,600 × 12
    taxableIncome -= 15_000;  // Medical ₹15,000/year
    taxableIncome -= (declaration.ltaAmount ?? 0);
  }

  // ── STEP 3: Standard deduction
  taxableIncome -= regime === TaxRegime.NEW ? 75_000 : 50_000;

  // ── STEP 4: 80C — Old regime only, max ₹1,50,000
  if (regime === TaxRegime.OLD && declaration) {
    const sec80C = Math.min(
      (declaration.section80C ?? 0) + pfEmployeeAnnual,
      150_000
    );
    taxableIncome -= sec80C;
  }

  // ── STEP 5: 80D — Old regime only 
  if (regime === TaxRegime.OLD && declaration?.section80D) {
    taxableIncome -= Math.min(declaration.section80D, 50_000);
  }

  // ── STEP 6: 80CCD(1B) NPS — both regimes, max ₹50,000 
  if (declaration?.section80CCD1B) {
    taxableIncome -= Math.min(declaration.section80CCD1B, 50_000);
  }

  // ── STEP 7: Home loan interest — Old regime only, max ₹2,00,000 
  if (regime === TaxRegime.OLD && declaration?.homeLoanInterest) {
    taxableIncome -= Math.min(declaration.homeLoanInterest, 200_000);
  }

  taxableIncome = Math.max(0, Math.round(taxableIncome));

  // ── STEP 8: Compute slab tax 
  const slabs = regime === TaxRegime.NEW ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  let annualTax = computeSlabTax(taxableIncome, slabs);

  // ── STEP 9: Surcharge 
  annualTax += computeSurcharge(taxableIncome, annualTax);

  // ── STEP 10: Health & Education Cess 4% 
  const cess             = Math.round(annualTax * 0.04);
  const annualTaxWithCess = annualTax + cess;

  // ── STEP 11: Monthly TDS = remaining liability / remaining months 
  // Adjusts automatically when employee submits new declaration mid-year
  const monthlyTDS = Math.round(annualTaxWithCess / Math.max(monthsRemaining, 1));

  return { annualTaxableIncome: taxableIncome, annualTax, annualTaxWithCess, monthlyTDS, regime };
}

// OVERTIME AGGREGATION
// Pull total approved OT amount for this employee this month

export async function getApprovedOTAmount(
  tenantId:   string,
  employeeId: string,
  year:       number,
  month:      number
): Promise<number> {
  const result = await OvertimeModel.aggregate([
    {
      $match: {
        tenantId:   new mongoose.Types.ObjectId(tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        year,
        month,
        status:     OTStatus.APPROVED,
        isDeleted:  false,
      },
    },
    { $group: { _id: null, totalOT: { $sum: "$otAmount" } } },
  ]);

  return result[0]?.totalOT ?? 0;
}

// GRATUITY MONTHLY PROVISION
// Employer cost accrual — NOT deducted from employee salary
// Formula: (Basic + DA) × 15 / 26 / 12

export function calculateMonthlyGratuityProvision(basicPlusDA: number): number {
  return Math.round((basicPlusDA * 15) / 26 / 12);
}

// NEGATIVE SALARY GUARD
// Hard block — never let a negative net pay reach disbursement

export function assertPositiveNetPay(
  employeeId:      string,
  netPay:          number,
  grossEarned:     number,
  totalDeductions: number
): void {
  if (netPay < 0) {
    throw new Error(
      `Negative net pay for employee ${employeeId}: ` +
      `Gross ₹${grossEarned.toFixed(2)} - Deductions ₹${totalDeductions.toFixed(2)} ` +
      `= ₹${netPay.toFixed(2)}. Review loan EMIs and LOP. Payslip blocked.`
    );
  }
}

// FINANCIAL YEAR HELPERS
// India FY: April–March. Auto-detected from payroll month/year.

export function getFinancialYear(year: number, month: number): string {
  // month >= 4 (April onwards) → FY starts this calendar year
  // month < 4 (Jan–Mar) → FY started last calendar year
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd   = String(fyStart + 1).slice(-2);
  return `${fyStart}-${fyEnd}`; // "2025-26"
}

export function getMonthsRemainingInFY(month: number): number {
  // April (month 4) → 12 months remaining in FY
  // March (month 3) → 1 month remaining
  if (month >= 4) return 12 - month + 4;
  return 4 - month;
}