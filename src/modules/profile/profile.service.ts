import mongoose from "mongoose";
import { UserModel } from "../user/user.model";
import { EmployeeModel } from "../employee/employee.model";
import { AttendanceModel } from "../attendance/attendance.model";
import { LeaveBalanceModel } from "../leave/leave-balance.model";
import { LeaveRequestModel } from "../leave/leave-request.model";
import { CompOffModel } from "../leave/comp-off.model";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { normalizeToMidnight } from "../attendance/attendance.util";

export class ProfileService {

  async getMyFullProfile(context: RequestContext) {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("-passwordHash");

    if (!user) throw new AppError(
      "User not found",
      404
    );

    // Super Admin / HR without an employee record — return account info only

    if (!user.employeeId) {
      return {
        account: user.toSafeObject(),
        employee: null,
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
          employeeId, attendanceDate: today,
        }),
        LeaveBalanceModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId, year,
        }).populate("leaveTypeId", "name code isPaid"),
        LeaveRequestModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId, status: "PENDING",
        }).populate("leaveTypeId", "name code").sort({ appliedAt: -1 }),
        CompOffModel.find({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId, status: "AVAILABLE", expiryDate: { $gt: new Date() },
        }),
      ]);

    return {
      account: user.toSafeObject(),
      employee,
      todayAttendance: todayAttendance ?? { status: "NOT_CHECKED_IN", sessions: [] },
      leaveBalances,
      pendingLeaveRequests,
      compOffAvailable,
    };


  }
}