import mongoose from "mongoose";
import { connectDatabase } from "./config/database";
import { EmployeeModel } from "./modules/employee/employee.model";
import { UserModel } from "./modules/user/user.model";
import { BranchModel } from "./modules/branch/branch.model";
import { OrganizationModel } from "./modules/organization/organization.model";
import { HolidayModel } from "./modules/leave/holiday.model";
import { resolveEmployeeDaySchedule, generateMonthCalendar } from "./modules/attendance/schedule-engine";

async function run() {
  await connectDatabase();

  const employee = await EmployeeModel.findOne({ branchId: { $ne: null } });
  if (!employee) {
    console.log("No employee with a branch found.");
    return;
  }
  console.log("Employee:", employee.firstName, employee.lastName, "BranchID:", employee.branchId);

  const branch = await BranchModel.findById(employee.branchId);
  if (!branch) {
    console.log("No branch found.");
    return;
  }
  console.log("Branch:", branch.name, "WorkPolicy:", JSON.stringify(branch.workPolicy, null, 2));

  const org = await OrganizationModel.findById(employee.tenantId);
  console.log("Org:", org?.companyName, "Locale:", JSON.stringify(org?.locale, null, 2));

  // Let's resolve the personal calendar days for August 2026 (year=2026, month=8)
  const year = 2026;
  const month = 8;

  const orgWeeklyOffDays = org?.locale?.weeklyOffDays ?? ["Sunday"];
  const orgCustomWeekOffRules = (org?.locale as any)?.customWeekOffRules;

  const branchWeeklyOffDays = branch.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;
  const branchCustomWeekOffRules = (branch.workPolicy as any)?.customWeekOffRules ?? orgCustomWeekOffRules;

  console.log("Resolved WeeklyOffDays:", branchWeeklyOffDays);
  console.log("Resolved CustomWeekOffRules:", JSON.stringify(branchCustomWeekOffRules, null, 2));

  const holidays = await HolidayModel.find({
    tenantId: employee.tenantId,
    date: { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0) },
    isDeleted: false,
  });

  const days = generateMonthCalendar({
    year,
    month,
    fixedWeeklyOffDays: branchWeeklyOffDays,
    customWeekOffRules: branchCustomWeekOffRules,
    holidays: holidays as any,
    branchId: branch._id.toString(),
  });

  console.log("=== CALENDAR DAYS FOR AUGUST 2026 ===");
  for (const day of days) {
    console.log(`Date: ${day.date} (${day.dayOfWeek}) - Type: ${day.type} - Reason: ${day.offReason}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
