import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../core/database/base.schema";

// The payslip is where Attendance + Leave + SalaryStructure actually
// converge into a number. This is the direct implementation of the
// interlink you asked about — every field below traces back to a read
// from Attendance.status / LeaveRequest.status for that month.

export interface AttendanceSummarySnapshot {
  totalDaysInMonth:  number;
  presentDays:       number;
  lateDays:          number;
  halfDays:          number;
  absentDays:        number;    // → drives LOP
  onLeaveDays:       number;    // approved leave — paid or unpaid depends on leave type
  paidLeaveDays:     number;    // subset of onLeaveDays where LeaveType.isPaid = true
  unpaidLeaveDays:   number;    // subset of onLeaveDays where LeaveType.isPaid = false → also drives LOP
  holidayDays:       number;
  weekOffDays:       number;
  payableDays:       number;    // totalDaysInMonth - absentDays - unpaidLeaveDays
}

export interface PayslipDeduction {
  componentCode: string;
  componentName: string;
  amount:        number;
}

export interface PayslipEarning {
  componentCode: string;
  componentName: string;
  amount:        number;    // pro-rated if payableDays < totalDaysInMonth
}

export interface PayslipDocument extends BaseDocument {
  payrollRunId:       mongoose.Types.ObjectId;
  employeeId:         mongoose.Types.ObjectId;
  salaryStructureId:  mongoose.Types.ObjectId;
  month:              number;
  year:               number;

  // The snapshot — this is the literal Attendance/Leave interlink,
  // frozen at generation time so a payslip never silently changes if
  // attendance records are edited later (audit trail requirement)
  attendanceSummary:  AttendanceSummarySnapshot;

  earnings:           PayslipEarning[];
  deductions:         PayslipDeduction[];

  grossEarned:        number;   // sum of earnings, already pro-rated
  totalDeductions:    number;   // sum of deductions (statutory + LOP)
  lopAmount:          number;   // deduction specifically attributable to absent/unpaid-leave days
  netPay:             number;   // grossEarned - totalDeductions

  pfEmployeeContribution?: number;
  pfEmployerContribution?: number;
  esiEmployeeContribution?: number;
  esiEmployerContribution?: number;
  ptAmount?:                number;
  tdsAmount?:                number;

  generatedAt:        Date;
  isFinalized:         boolean;   // true once the parent PayrollRun is APPROVED — immutable after
}

const AttendanceSummarySchema = new mongoose.Schema(
  {
    totalDaysInMonth: { type: Number, required: true },
    presentDays:      { type: Number, default: 0 },
    lateDays:         { type: Number, default: 0 },
    halfDays:         { type: Number, default: 0 },
    absentDays:       { type: Number, default: 0 },
    onLeaveDays:      { type: Number, default: 0 },
    paidLeaveDays:    { type: Number, default: 0 },
    unpaidLeaveDays:  { type: Number, default: 0 },
    holidayDays:      { type: Number, default: 0 },
    weekOffDays:      { type: Number, default: 0 },
    payableDays:      { type: Number, required: true },
  },
  { _id: false }
);

const PayslipEarningSchema = new mongoose.Schema(
  {
    componentCode: { type: String, required: true },
    componentName: { type: String, required: true },
    amount:        { type: Number, required: true },
  },
  { _id: false }
);

const PayslipDeductionSchema = new mongoose.Schema(
  {
    componentCode: { type: String, required: true },
    componentName: { type: String, required: true },
    amount:        { type: Number, required: true },
  },
  { _id: false }
);

const PayslipSchema = createBaseSchema<PayslipDocument>(
  {
    payrollRunId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    salaryStructureId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
    },
    month: { type: Number, required: true },
    year:  { type: Number, required: true },

    attendanceSummary: {
      type:     AttendanceSummarySchema,
      required: true,
    },

    earnings:   { type: [PayslipEarningSchema],   default: [] },
    deductions: { type: [PayslipDeductionSchema], default: [] },

    grossEarned:      { type: Number, required: true },
    totalDeductions:  { type: Number, required: true },
    lopAmount:        { type: Number, default: 0 },
    netPay:           { type: Number, required: true },

    pfEmployeeContribution:  { type: Number },
    pfEmployerContribution:  { type: Number },
    esiEmployeeContribution: { type: Number },
    esiEmployerContribution: { type: Number },
    ptAmount:                 { type: Number },
    tdsAmount:                 { type: Number },

    generatedAt:  { type: Date, default: Date.now },
    isFinalized:  { type: Boolean, default: false },
  },
  { collection: "payslips" }
);

// One payslip per employee per payroll run — the core invariant
PayslipSchema.index({ tenantId: 1, payrollRunId: 1, employeeId: 1 }, { unique: true });
PayslipSchema.index({ tenantId: 1, employeeId: 1, year: 1, month: 1 });

export const PayslipModel = mongoose.model<PayslipDocument>(
  "Payslip",
  PayslipSchema
);