declare const process: any;

import {
  PayrollCalendarPolicyService,
} from "../src/modules/payroll/services/payroll-calendar-policy.service";
import {
  PayrollCycleType,
  AttendanceCutoffType,
  PayrollProcessingType,
  SalaryDisbursementType,
  LOPCalculationBase,
} from "../src/modules/payroll/models/payroll-calendar-policy.model";

function runTests() {
  const service = new PayrollCalendarPolicyService();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  console.log("==================================================");
  console.log("TEST SUITE: Payroll Calendar Policy Unit Tests");
  console.log("==================================================");

  // ── Test 1: Default Fallback Policy
  const defaultPolicy = service.getDefaultPolicy();
  assert(defaultPolicy.payrollCycleType === PayrollCycleType.CALENDAR_MONTH, "Default cycle is CALENDAR_MONTH");
  assert(defaultPolicy.lopCalculationBase === LOPCalculationBase.CALENDAR_DAYS, "Default LOP is CALENDAR_DAYS");

  // ── Test 2: Standard August 2026 (31 days) with Default Policy
  const augDefaultCycle = service.calculateCycleDates(defaultPolicy, 2026, 8);
  assert(augDefaultCycle.period === "2026-08", "Period is 2026-08");
  assert(augDefaultCycle.cycleStartDate.getDate() === 1, "Cycle starts on 1st");
  assert(augDefaultCycle.cycleEndDate.getDate() === 31, "Cycle ends on 31st");
  assert(augDefaultCycle.totalDaysInPeriod === 31, "Total days in Aug is 31");
  assert(augDefaultCycle.lopDivisor === 31, "Aug LOP divisor is 31 for calendar days");

  // ── Test 3: Custom Cycle (26th to 25th)
  const customPolicy = {
    ...defaultPolicy,
    payrollCycleType: PayrollCycleType.CUSTOM_RANGE,
    customCycleStartDay: 26,
    attendanceCutoffType: AttendanceCutoffType.FIXED_DATE,
    attendanceCutoffValue: 25,
    payrollProcessingType: AttendanceCutoffType.FIXED_DATE as any,
    payrollProcessingValue: 28,
    salaryDisbursementType: SalaryDisbursementType.FIXED_DATE,
    salaryDisbursementValue: 1,
    lopCalculationBase: LOPCalculationBase.FIXED_26,
  };

  const customCycle = service.calculateCycleDates(customPolicy, 2026, 8);
  assert(customCycle.cycleStartDate.getMonth() === 6, "Start date is in July (Month index 6)");
  assert(customCycle.cycleStartDate.getDate() === 26, "Start date is July 26th");
  assert(customCycle.cycleEndDate.getMonth() === 7, "End date is in August (Month index 7)");
  assert(customCycle.cycleEndDate.getDate() === 25, "End date is August 25th");
  assert(customCycle.attendanceCutoffDate.getDate() === 25, "Cutoff date is August 25th");
  assert(customCycle.salaryDisbursementDate.getMonth() === 8, "Disbursement is September (Month index 8)");
  assert(customCycle.salaryDisbursementDate.getDate() === 1, "Disbursement is September 1st");
  assert(customCycle.lopDivisor === 26, "LOP Divisor is exactly 26 for FIXED_26");

  // ── Test 4: LOP Calculation Base Resolution
  const feb2024DivisorCalendar = service.getEffectiveLOPDivisor(
    { lopCalculationBase: LOPCalculationBase.CALENDAR_DAYS },
    2024,
    2 // Leap year
  );
  assert(feb2024DivisorCalendar === 29, "Leap year Feb divisor is 29 for CALENDAR_DAYS");

  const febDivisorFixed26 = service.getEffectiveLOPDivisor(
    { lopCalculationBase: LOPCalculationBase.FIXED_26 },
    2026,
    2
  );
  assert(febDivisorFixed26 === 26, "Feb divisor is 26 when FIXED_26");

  const workingDaysDivisor = service.getEffectiveLOPDivisor(
    { lopCalculationBase: LOPCalculationBase.ACTUAL_WORKING_DAYS },
    2026,
    8,
    22 // 22 working days
  );
  assert(workingDaysDivisor === 22, "Divisor matches actual working days (22)");

  // ── Test 5: Last Working Day Disbursement
  const lastWorkingDayPolicy = {
    ...defaultPolicy,
    salaryDisbursementType: SalaryDisbursementType.LAST_WORKING_DAY,
  };
  const oct2026Cycle = service.calculateCycleDates(lastWorkingDayPolicy, 2026, 10);
  // Oct 31, 2026 is Saturday -> should shift to Friday Oct 30
  assert(oct2026Cycle.salaryDisbursementDate.getDate() === 30, "Oct 31 Saturday shifts disbursement to Friday Oct 30");

  console.log("==================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
