import mongoose from "mongoose";
import { LeaveRequestRepository } from "./leave-request.repository";
import { LeaveTypeRepository } from "./leave-type.repository";
import { LeaveBalanceService } from "./leave-balance.service";
import { LeaveRequestModel, LeaveRequestStatus, ApprovalLevelStatus } from "./leave-request.model";
import { HolidayModel } from "./holiday.model";
import { BranchModel } from "../branch/branch.model";
import { UserModel } from "../user/user.model";
import { EmployeeModel } from "../employee/employee.model";
import { CreateLeaveRequestInput, ReviewLeaveRequestInput, CancelLeaveRequestInput, } from "./leave.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { calculateLeaveDays, applySandwichPolicy, buildApprovalChain, } from "./leave.util";
import { AttendanceModel } from "../attendance/attendance.model";
import { normalizeToMidnight } from "../attendance/attendance.util";

export class LeaveRequestService {
  private reqRepo = new LeaveRequestRepository();
  private leaveTypeRepo = new LeaveTypeRepository();
  private balanceService = new LeaveBalanceService();

  private async resolveOwnEmployeeId(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId");
    if (!user?.employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }
    return user.employeeId.toString();
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
      const branch = await BranchModel.findById(employee.branchId).select("workPolicy");
      const weeklyOffDays = branch?.workPolicy?.weeklyOffDays ?? ["Saturday", "Sunday"];

      const holidays = await HolidayModel.find({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        date: { $gte: new Date(fromDate.getTime() - 172800000), $lte: new Date(toDate.getTime() + 172800000) },
        isDeleted: false,
      }).select("date");

      const result = applySandwichPolicy(
        baseDays, fromDate, toDate, weeklyOffDays, holidays.map(h => h.date)
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

    return request;
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

    if (request.employeeId.toString() !== employeeId) {
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
        context, employeeId, request.leaveTypeId.toString(), year
      );
      balance.used = Math.max(0, balance.used - request.totalDays);
      balance.available = balance.allocated + balance.carriedForward - balance.used - balance.pending;
      await (balance as any).save();
    } else {
      await this.balanceService.releaseReservation(
        context, employeeId, request.leaveTypeId.toString(), year, request.totalDays
      );
    }

    return request;
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

    if (currentStep.approverRole !== context.role && context.role !== "SUPER_ADMIN") {
      throw new AppError(
        `Only a ${currentStep.approverRole} can act on this approval level`,
        403
      );
    }

    currentStep.status = input.status === "APPROVED" ? ApprovalLevelStatus.APPROVED : ApprovalLevelStatus.REJECTED;
    currentStep.approverId = new mongoose.Types.ObjectId(context.userId);
    currentStep.comments = input.reviewComments;
    currentStep.actedAt = new Date();

    const year = request.fromDate.getFullYear();

    if (input.status === "REJECTED") {
      request.status = LeaveRequestStatus.REJECTED;
      await this.balanceService.releaseReservation(
        context, request.employeeId.toString(), request.leaveTypeId.toString(), year, request.totalDays
      );
    } else {
      const isLastLevel = request.currentApprovalLevel >= request.approvals.length;
      if (isLastLevel) {
        request.status = LeaveRequestStatus.APPROVED;
        await this.balanceService.confirmUsage(
          context, request.employeeId.toString(), request.leaveTypeId.toString(), year, request.totalDays
        );
        await this.syncToAttendance(context, request);
      } else {
        request.currentApprovalLevel += 1;
      }
    }

    await this.reqRepo.save(request);
    return request;
  }

  //Approved leave → mark attendance ON_LEAVE for the date range
  private async syncToAttendance(context: RequestContext, request: any) {

    const current = new Date(request.fromDate);
    const end = new Date(request.toDate);

    while (current <= end) {
      const date = normalizeToMidnight(new Date(current));

      await AttendanceModel.findOneAndUpdate(
        {
          tenantId: request.tenantId,
          employeeId: request.employeeId,
          attendanceDate: date,
        },
        {
          $setOnInsert: {
            tenantId: request.tenantId,
            branchId: request.branchId,
            employeeId: request.employeeId,
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