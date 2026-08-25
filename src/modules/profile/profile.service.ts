import mongoose from "mongoose";
import { UserModel } from "../user/user.model";
import { EmployeeModel } from "../employee/models/employee.model";
import { AttendanceModel } from "../attendance/models/attendance.model";
import { LeaveBalanceModel } from "../leave/sub-modules/leave-balances/leave-balance.model";
import { LeaveRequestModel } from "../leave/sub-modules/leave-requests/leave-request.model";
import { CompOffModel } from "../leave/sub-modules/comp-off/comp-off.model";
import { CustomFieldService } from "../custom-field/custom-field.service";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { normalizeToMidnight } from "../attendance/attendance.util";

export class ProfileService {
  private customFieldService = new CustomFieldService();

  async getMyFullProfile(context: RequestContext) {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("-passwordHash");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Super Admin / HR without an employee record — return account info only
    if (!user.employeeId) {
      return {
        account: user.toSafeObject(),
        employee: null,
        customFieldDefinitions: [],
        todayAttendance: null,
        leaveBalances: [],
        pendingLeaveRequest: [],
        compOffAvailable: [],
      };
    }

    const employeeId = user.employeeId;
    const today = normalizeToMidnight(new Date());
    const year = new Date().getFullYear();

    const [employee, todayAttendance, leaveBalances, pendingLeaveRequests, compOffAvailable] =
      await Promise.all([
        EmployeeModel.findById(employeeId)
          .populate("departmentId", "name")
          .populate("designationId", "name")
          .populate("branchId", "name code"),
        AttendanceModel.findOne({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId,
          attendanceDate: today,
        }),
        LeaveBalanceModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId,
          year,
        }).populate("leaveTypeId", "name code isPaid"),
        LeaveRequestModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId,
          status: "PENDING",
        }).populate("leaveTypeId", "name code").sort({ appliedAt: -1 }),
        CompOffModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId,
          status: "AVAILABLE",
          expiryDate: { $gt: new Date() },
        }),
      ]);

    // Load effective custom fields configured for employee's branch/department
    const branchIdStr = (employee as any)?.branchId?._id?.toString() || (employee as any)?.branchId?.toString();
    const deptIdStr = (employee as any)?.departmentId?._id?.toString() || (employee as any)?.departmentId?.toString();
    const customFieldDefinitions = await this.customFieldService.getEffectiveFieldsForEmployee(
      context.tenantId,
      branchIdStr,
      deptIdStr,
      {}
    );

    return {
      account: user.toSafeObject(),
      employee,
      customFieldDefinitions: customFieldDefinitions.map((f: any) => ({
        _id: f._id,
        fieldLabel: f.fieldLabel,
        fieldKey: f.fieldKey,
        fieldType: f.fieldType,
        uiComponent: f.uiComponent || "DROPDOWN",
        scope: f.scope,
        wizardStep: f.wizardStep || 1,
        section: f.section || "PERSONAL_DETAILS",
        options: (f.options || []).map((opt: any) =>
          typeof opt === "string" ? { label: opt, value: opt } : opt
        ),
        placeholder: f.placeholder,
        helperText: f.helperText,
        defaultValue: f.defaultValue,
        isRequired: f.isRequired,
        order: f.order,
      })),
      todayAttendance: todayAttendance ?? { status: "NOT_CHECKED_IN", sessions: [] },
      leaveBalances,
      pendingLeaveRequests,
      compOffAvailable,
    };
  }
}