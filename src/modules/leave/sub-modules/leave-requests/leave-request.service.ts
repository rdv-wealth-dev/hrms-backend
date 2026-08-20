import mongoose from "mongoose";
import { LeaveRequestRepository } from "./leave-request.repository";
import { LeaveTypeRepository } from "../leave-types/leave-type.repository";
import { LeaveBalanceService } from "../leave-balances/leave-balance.service";
import { LeaveRequestModel, LeaveRequestStatus, ApprovalLevelStatus } from "./leave-request.model";
import { HolidayModel } from "../holidays/holiday.model";
import { BranchModel } from "../../../branch/branch.model";
import { OrganizationModel } from "../../../organization/organization.model";
import { UserModel } from "../../../user/user.model";
import { EmployeeModel } from "../../../employee/models/employee.model";
import { CreateLeaveRequestInput, ReviewLeaveRequestInput, CancelLeaveRequestInput, } from "../../dto/leave.dto";
import { AppError } from "../../../../shared/errors/app.error";
import { RequestContext } from "../../../../shared/types/request-context.interface";
import { calculateLeaveDays, applySandwichPolicy, buildApprovalChain, } from "../../utils/leave.util";
import { AttendanceModel } from "../../../attendance/models/attendance.model";
import { normalizeToMidnight } from "../../../attendance/attendance.util";
import { auditService } from "../../../audit/audit.service";

export class LeaveRequestService {
  private reqRepo = new LeaveRequestRepository();
  private leaveTypeRepo = new LeaveTypeRepository();
  private balanceService = new LeaveBalanceService();

  async resolveOwnEmployeeId(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId email");

    let employeeId = user?.employeeId?.toString();

    if (!employeeId && user) {
      const emp = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        $or: [
          { userId: user._id },
          { email: user.email },
        ],
        isDeleted: false,
      });

      if (emp) {
        employeeId = emp._id.toString();
        await UserModel.updateOne({ _id: user._id }, { employeeId: emp._id });
      }
    }

    if (!employeeId && (context.role === "ORG_ADMIN" || context.role === "SUPER_ADMIN")) {
      const firstEmp = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      });
      if (firstEmp) {
        employeeId = firstEmp._id.toString();
      }
    }

    if (!employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }
    return employeeId;
  }


  //Self-service — apply for leave
  async createRequest(context: RequestContext, input: CreateLeaveRequestInput) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const leaveType = await this.leaveTypeRepo.findById(context, input.leaveTypeId);
    if (!leaveType) throw new AppError("Leave type not found", 404);

    const fromDate = new Date(input.fromDate);
    const toDate = new Date(input.toDate);

    if (toDate < fromDate) {
      throw new AppError("toDate cannot be before fromDate", 400);
    }

    // Advance notice validation
    const daysNotice = Math.floor((fromDate.getTime() - Date.now()) / 86400000);
    if (leaveType.advanceNoticeDays > 0 && daysNotice < leaveType.advanceNoticeDays) {
      throw new AppError(
        `This leave type requires at least ${leaveType.advanceNoticeDays} days advance notice`,
        400
      );
    }
    if (leaveType.minAdvanceNoticeDays > 0 && daysNotice > leaveType.minAdvanceNoticeDays) {
      throw new AppError(
        `This leave type must be applied within ${leaveType.minAdvanceNoticeDays} days of the leave date`,
        400
      );
    }

    // Base day calculation
    const baseDays = calculateLeaveDays(
      fromDate, toDate,
      input.fromSession as any, input.toSession as any
    );

    if (leaveType.maxConsecutiveDays > 0 && baseDays > leaveType.maxConsecutiveDays) {
      throw new AppError(
        `Maximum ${leaveType.maxConsecutiveDays} consecutive days allowed for this leave type`,
        400
      );
    }

    // Sandwich policy — only applied if the leave type has it enabled
    let totalDays = baseDays;
    let isSandwiched = false;

    if (leaveType.applySandwichPolicy) {
      const org = await OrganizationModel.findById(context.tenantId);
      const orgWeeklyOffDays = org?.locale?.weeklyOffDays ?? ["Sunday"];
      const orgCustomWeekOffRules = (org?.locale as any)?.customWeekOffRules;

      const branch = await BranchModel.findById(employee.branchId).select("workPolicy");
      const branchWeeklyOffDays = branch?.workPolicy?.weeklyOffDays ?? orgWeeklyOffDays;
      const branchCustomWeekOffRules = (branch?.workPolicy as any)?.customWeekOffRules ?? orgCustomWeekOffRules;

      const holidays = await HolidayModel.find({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        date: { $gte: new Date(fromDate.getTime() - 172800000), $lte: new Date(toDate.getTime() + 172800000) },
        isDeleted: false,
      }).select("date");

      const result = applySandwichPolicy(
        baseDays,
        fromDate,
        toDate,
        branchWeeklyOffDays,
        holidays.map(h => h.date),
        branchCustomWeekOffRules
      );
      totalDays = result.totalDays;
      isSandwiched = result.isSandwiched;
    }

    const year = fromDate.getFullYear();

    // Reserve balance — throws if insufficient (unless allowNegativeBalance)
    await this.balanceService.reserveDays(
      context, employeeId, input.leaveTypeId, year, totalDays, leaveType.allowNegativeBalance
    );

    const approvals = buildApprovalChain(leaveType.approvalLevels);

    const request = await this.reqRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      leaveTypeId: new mongoose.Types.ObjectId(input.leaveTypeId) as any,
      fromDate, toDate,
      fromSession: input.fromSession as any,
      toSession: input.toSession as any,
      totalDays, baseDays, isSandwiched,
      reason: input.reason,
      status: leaveType.requiresApproval
        ? LeaveRequestStatus.PENDING
        : LeaveRequestStatus.APPROVED,
      currentApprovalLevel: 1,
      approvals: approvals as any,
      appliedAt: new Date(),
    });

    // Auto-approve path — no approval required by this leave type's policy
    if (!leaveType.requiresApproval) {
      await this.balanceService.confirmUsage(context, employeeId, input.leaveTypeId, year, totalDays);
    }

    const populated = await LeaveRequestModel.findById(request._id)
      .populate("employeeId", "employeeCode firstName lastName avatarUrl profilePicture")
      .populate("leaveTypeId", "name code isPaid");

    return populated;
  }

  //Self-service — my requests
  async getMyRequests(context: RequestContext, page: number, pageSize: number) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    return this.reqRepo.findForEmployee(context, employeeId, page, pageSize);
  }

  //Self-service — cancel
  async cancelRequest(context: RequestContext, id: string, input: CancelLeaveRequestInput) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    const request = await this.reqRepo.findById(context, id);
    if (!request) throw new AppError("Leave request not found", 404);

    const reqEmpId = (request.employeeId as any)?._id
      ? (request.employeeId as any)._id.toString()
      : request.employeeId.toString();
    const reqLeaveTypeId = (request.leaveTypeId as any)?._id
      ? (request.leaveTypeId as any)._id.toString()
      : request.leaveTypeId.toString();

    if (reqEmpId !== employeeId) {
      throw new AppError("You can only cancel your own leave requests", 403);
    }
    if (request.status === LeaveRequestStatus.CANCELLED) {
      throw new AppError("This request is already cancelled", 400);
    }
    if (request.status === LeaveRequestStatus.APPROVED && request.fromDate < new Date()) {
      throw new AppError("Cannot cancel a leave that has already started", 400);
    }

    const wasApproved = request.status === LeaveRequestStatus.APPROVED;

    request.status = LeaveRequestStatus.CANCELLED;
    request.cancelledAt = new Date();
    request.cancelReason = input.cancelReason;
    await this.reqRepo.save(request);

    const year = request.fromDate.getFullYear();
    if (wasApproved) {
      // Was already deducted from "used" — need to give it back
      const balance = await this.balanceService.getOrCreateBalance(
        context, employeeId, reqLeaveTypeId, year
      );
      balance.used = Math.max(0, balance.used - request.totalDays);
      balance.available = balance.allocated + balance.carriedForward - balance.used - balance.pending;
      await (balance as any).save();
    } else {
      await this.balanceService.releaseReservation(
        context, employeeId, reqLeaveTypeId, year, request.totalDays
      );
    }

    return this.reqRepo.findById(context, id);
  }

  //Admin/Manager — pending queue for their role
  async getPendingForRole(context: RequestContext, approverRole: string, page: number, pageSize: number) {
    return this.reqRepo.findPendingForApproverRole(context, approverRole, page, pageSize);
  }

  //Admin/Manager — review a level
  async review(context: RequestContext, id: string, input: ReviewLeaveRequestInput) {
    const request = await this.reqRepo.findById(context, id);
    if (!request) throw new AppError("Leave request not found", 404);
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new AppError("This request is not pending review", 400);
    }

    const currentStep = request.approvals.find(
      (a) => a.level === request.currentApprovalLevel
    );
    if (!currentStep) throw new AppError("Approval chain misconfigured", 500);

    if (currentStep.approverRole !== context.role && context.role !== "ORG_ADMIN") {
      throw new AppError(
        `Only a ${currentStep.approverRole} can act on this approval level`,
        403
      );
    }

    currentStep.status = input.status === "APPROVED" ? ApprovalLevelStatus.APPROVED : ApprovalLevelStatus.REJECTED;
    currentStep.approverId = new mongoose.Types.ObjectId(context.userId);
    currentStep.comments = input.reviewComments;
    currentStep.actedAt = new Date();

    const reqEmpId = (request.employeeId as any)?._id
      ? (request.employeeId as any)._id.toString()
      : request.employeeId.toString();
    const reqLeaveTypeId = (request.leaveTypeId as any)?._id
      ? (request.leaveTypeId as any)._id.toString()
      : request.leaveTypeId.toString();

    const year = request.fromDate.getFullYear();

    if (input.status === "REJECTED") {
      request.status = LeaveRequestStatus.REJECTED;
      await this.balanceService.releaseReservation(
        context, reqEmpId, reqLeaveTypeId, year, request.totalDays
      );
    } else {
      const isLastLevel = request.currentApprovalLevel >= request.approvals.length;
      if (isLastLevel) {
        request.status = LeaveRequestStatus.APPROVED;
        await this.balanceService.confirmUsage(
          context, reqEmpId, reqLeaveTypeId, year, request.totalDays
        );
        await this.syncToAttendance(context, request);
      } else {
        request.currentApprovalLevel += 1;
      }
    }

    await this.reqRepo.save(request);

    await auditService.logAction({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: "",
      module: "leave",
      action: input.status === "APPROVED" ? "APPROVE" : "REJECT",
      resourceType: "LeaveRequest",
      resourceId: id,
      oldValue: { status: "PENDING" },
      newValue: { status: input.status },
    });

    return this.reqRepo.findById(context, id);
  }

  //Approved leave → mark attendance ON_LEAVE for the date range
  private async syncToAttendance(context: RequestContext, request: any) {
    const empObjectId = (request.employeeId as any)?._id
      ? (request.employeeId as any)._id
      : request.employeeId;
    const branchObjectId = (request.branchId as any)?._id
      ? (request.branchId as any)._id
      : request.branchId;

    const current = new Date(request.fromDate);
    const end = new Date(request.toDate);

    while (current <= end) {
      const date = normalizeToMidnight(new Date(current));

      await AttendanceModel.findOneAndUpdate(
        {
          tenantId: request.tenantId,
          employeeId: empObjectId,
          attendanceDate: date,
        },
        {
          $setOnInsert: {
            tenantId: request.tenantId,
            branchId: branchObjectId,
            employeeId: empObjectId,
            shiftId: request.shiftId ?? null,
            attendanceDate: date,
            sessions: [],
            workedMinutes: 0,
            isRegularized: false,
          },
          $set: { status: "ON_LEAVE" },
        },
        { upsert: true }
      );

      current.setDate(current.getDate() + 1);
    }
  }

  //Admin — report
  async getReport(context: RequestContext, filters: Record<string, unknown>, page: number, pageSize: number) {
    return this.reqRepo.findReport(context, filters, page, pageSize);
  }
}

