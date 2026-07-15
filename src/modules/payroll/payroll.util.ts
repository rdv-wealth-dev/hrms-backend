import mongoose from "mongoose";
import { AttendanceModel } from "../attendance/attendance.model";
import { LeaveRequestModel } from "../leave/leave-request.model";
import { LeaveTypeModel } from "../leave/leave-type.model";
import { SalaryStructureDocument, SalaryLineItem } from "./salary-structure.model";
import { AttendanceSummarySnapshot, PayslipEarning, PayslipDeduction } from "./payslip.model";

// Build the Attendance/Leave summary for one employee, one month
// This is the literal interlink point: reads Attendance records for the
// month, cross-references ON_LEAVE days against their LeaveRequest's
// LeaveType.isPaid flag to split paid vs unpaid leave, and computes
// payableDays which drives the LOP deduction.
export async function buildAttendanceSummary(
  tenantId:   string,
  employeeId: string,
  year:       number,
  month:      number // 1-12
): Promise<AttendanceSummarySnapshot> {

  const fromDate = new Date(year, month - 1, 1);
  const toDate   = new Date(year, month, 0, 23, 59, 59);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const records = await AttendanceModel.find({
    tenantId:       new mongoose.Types.ObjectId(tenantId),
    employeeId:     new mongoose.Types.ObjectId(employeeId),
    attendanceDate: { $gte: fromDate, $lte: toDate },
    isDeleted:      false,
  });

  const summary: AttendanceSummarySnapshot = {
    totalDaysInMonth,
    presentDays: 0, lateDays: 0, halfDays: 0, absentDays: 0,
    onLeaveDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0,
    holidayDays: 0, weekOffDays: 0,
    payableDays: 0,
  };

  // Cache leave type paid/unpaid lookups within this run to avoid N+1 queries
  const leaveTypeCache = new Map<string, boolean>();

  for (const r of records) {
    switch (r.status) {
      case "PRESENT":  summary.presentDays++; break;
      case "LATE":     summary.lateDays++; break;
      case "HALF_DAY": summary.halfDays++; break;
      case "ABSENT":   summary.absentDays++; break;
      case "HOLIDAY":  summary.holidayDays++; break;
      case "WEEK_OFF": summary.weekOffDays++; break;
      case "ON_LEAVE": {
        summary.onLeaveDays++;

        // Find the approved leave request covering this date to determine paid/unpaid
        const leaveReq = await LeaveRequestModel.findOne({
          tenantId:   new mongoose.Types.ObjectId(tenantId),
          employeeId: new mongoose.Types.ObjectId(employeeId),
          status:     "APPROVED",
          fromDate:   { $lte: r.attendanceDate },
          toDate:     { $gte: r.attendanceDate },
          isDeleted:  false,
        }).select("leaveTypeId");

        if (leaveReq) {
          const key = leaveReq.leaveTypeId.toString();
          if (!leaveTypeCache.has(key)) {
            const lt = await LeaveTypeModel.findById(leaveReq.leaveTypeId).select("isPaid");
            leaveTypeCache.set(key, lt?.isPaid ?? true);
          }
          if (leaveTypeCache.get(key)) {
            summary.paidLeaveDays++;
          } else {
            summary.unpaidLeaveDays++;
          }
        } else {
          // ON_LEAVE status with no traceable request — treat conservatively as paid
          summary.paidLeaveDays++;
        }
        break;
      }
    }
  }

  // Days with no attendance record at all (shouldn't normally happen if the
  // closeout job ran, but guard against gaps) count as absent for payroll safety
  const accountedDays = summary.presentDays + summary.lateDays + summary.halfDays +
    summary.absentDays + summary.onLeaveDays + summary.holidayDays + summary.weekOffDays;
  const unaccountedDays = Math.max(0, totalDaysInMonth - accountedDays);
  summary.absentDays += unaccountedDays;

  // payableDays = every day except unpaid absence (ABSENT + unpaid leave)
  summary.payableDays = totalDaysInMonth - summary.absentDays - summary.unpaidLeaveDays;

  return summary;
}

// Pro-rate an earning component based on payable days 
// Statutory/fixed components (PF, ESI base) are NOT pro-rated here — only
// gross earnings are. Statutory deductions are calculated off the resulting
// pro-rated wages figure in the next function.
export function proRateEarnings(
  lineItems:       SalaryLineItem[],
  payableDays:     number,
  totalDaysInMonth: number
): PayslipEarning[] {
  const ratio = payableDays / totalDaysInMonth;

  return lineItems.map((item) => ({
    componentCode: item.componentCode,
    componentName: item.componentCode, // resolved to full name at service layer via component lookup
    amount: Math.round(item.amount * ratio * 100) / 100,
  }));
}

//Statutory deduction calculations
// India-specific defaults, kept as pure functions reading from Organization.statutory
// flags rather than being unconditionally applied — matches the compliance-pack
// principle from the policy documents: these are defaults, not hardcoded musts.

const PF_EMPLOYEE_RATE = 0.12;   // 12% of wages, employee side
const PF_EMPLOYER_RATE = 0.12;   // 12% of wages, employer side
const PF_WAGE_CEILING  = 15000;  // statutory PF wage ceiling — configurable in future

const ESI_EMPLOYEE_RATE   = 0.0075; // 0.75%
const ESI_EMPLOYER_RATE   = 0.0325; // 3.25%
const ESI_WAGE_THRESHOLD  = 21000;  // ESI only applies below this gross wage

export function calculatePF(wagesForStatutory: number, pfEnabled: boolean) {
  if (!pfEnabled) return { employee: 0, employer: 0 };
  const base = Math.min(wagesForStatutory, PF_WAGE_CEILING);
  return {
    employee: Math.round(base * PF_EMPLOYEE_RATE),
    employer: Math.round(base * PF_EMPLOYER_RATE),
  };
}

export function calculateESI(grossMonthly: number, esiEnabled: boolean) {
  if (!esiEnabled || grossMonthly > ESI_WAGE_THRESHOLD) {
    return { employee: 0, employer: 0 };
  }
  return {
    employee: Math.round(grossMonthly * ESI_EMPLOYEE_RATE),
    employer: Math.round(grossMonthly * ESI_EMPLOYER_RATE),
  };
}

// Professional Tax — state-specific slabs, simplified flat default here.
// Real implementation should read a per-state PT slab table; this is a
// safe placeholder that can be overridden per organization/branch.
export function calculatePT(grossMonthly: number, ptEnabled: boolean): number {
  if (!ptEnabled) return 0;
  if (grossMonthly <= 15000) return 0;
  if (grossMonthly <= 25000) return 175;
  return 200;
}

// TDS — genuinely complex (slab-based, regime-dependent, investment
// declarations). This is intentionally a simple flat-percentage placeholder,
// not a real tax engine — flag this clearly so nobody assumes it's compliant.
export function calculateTDS(annualGrossProjected: number, tdsEnabled: boolean): number {
  if (!tdsEnabled) return 0;
  // Placeholder only — a real TDS engine needs slab rates, regime choice,
  // Section 80C/80D declarations, and HRA exemption calculation.
  if (annualGrossProjected <= 700000) return 0;
  return Math.round(annualGrossProjected * 0.05 / 12); // rough monthly estimate
}