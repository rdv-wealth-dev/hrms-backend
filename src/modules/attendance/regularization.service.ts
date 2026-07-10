import mongoose from "mongoose";
import { RegularizationRepository } from "./regularization.repository";
import { AttendanceRepository } from "./attendance.repository";
import { RegularizationModel, RegularizationStatus } from "./regularization.model";
import { CreateRegularizationInput, ReviewRegularizationInput } from "./attendance.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { SessionType, PunchSource } from "./attendance.model";
import { calculateWorkedMinutes } from "./attendance.util";
import { UserModel } from "../user/user.model";

export class RegularizationService {
  private regRepo = new RegularizationRepository();
  private attRepo = new AttendanceRepository();

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

  // Employee requests a correction
  async createRequest(context: RequestContext, input: CreateRegularizationInput) {
    const employeeId  = await this.resolveOwnEmployeeId(context);
    const attendance  = await this.attRepo.findById(context, input.attendanceId);

    if (!attendance) throw new AppError("Attendance record not found", 404);
    if (attendance.employeeId.toString() !== employeeId) {
      throw new AppError("You can only regularize your own attendance", 403);
    }

    // Prevent duplicate — only one pending request per attendance record
    const existing = await RegularizationModel.findOne({
      tenantId:     new mongoose.Types.ObjectId(context.tenantId),
      employeeId:   new mongoose.Types.ObjectId(employeeId),
      attendanceId: attendance._id,
      status:       RegularizationStatus.PENDING,
      isDeleted:    false,
    });
    if (existing) {
      throw new AppError(
        "You already have a pending request for this attendance record",
        409
      );
    }

    return this.regRepo.create(context, {
      tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:      attendance.branchId as any,
      employeeId:    new mongoose.Types.ObjectId(employeeId) as any,
      attendanceId:  attendance._id as any,
      attendanceDate: attendance.attendanceDate,
      requestedCheckIn:  input.requestedCheckIn  ? new Date(input.requestedCheckIn)  : undefined,
      requestedCheckOut: input.requestedCheckOut ? new Date(input.requestedCheckOut) : undefined,
      reason: input.reason,
      status: RegularizationStatus.PENDING as any,
    });
  }

  // Employee's own requests
  async getMyRequests(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    return this.regRepo.findAll(
      context, { employeeId: new mongoose.Types.ObjectId(employeeId) },
      { pageNumber: 1, pageSize: 50 }
    );
  }

  //  Manager/HR — pending queue
  async getPendingRequests(context: RequestContext) {
    return this.regRepo.findPendingForBranch(context);
  }

  //  Manager/HR — approve or reject 
  async review(context: RequestContext, id: string, input: ReviewRegularizationInput) {
    const request = await this.regRepo.findById(context, id);
    if (!request) throw new AppError("Regularization request not found", 404);
    if (request.status !== RegularizationStatus.PENDING) {
      throw new AppError("This request has already been reviewed", 400);
    }

    request.status         = input.status as RegularizationStatus;
    request.reviewedBy     = new mongoose.Types.ObjectId(context.userId);
    request.reviewedAt     = new Date();
    request.reviewComments = input.reviewComments;
    await request.save();

    // On approval — apply the correction to the actual attendance record
    if (input.status === "APPROVED") {
      const attendance = await this.attRepo.findById(context, request.attendanceId.toString());
      if (attendance) {
        if (request.requestedCheckIn) {
          attendance.sessions.push({
            type: SessionType.CHECK_IN,
            timestamp: request.requestedCheckIn,
            source: PunchSource.MANUAL,
          });
          if (!attendance.firstCheckIn) attendance.firstCheckIn = request.requestedCheckIn;
        }
        if (request.requestedCheckOut) {
          attendance.sessions.push({
            type: SessionType.CHECK_OUT,
            timestamp: request.requestedCheckOut,
            source: PunchSource.MANUAL,
          });
          attendance.lastCheckOut = request.requestedCheckOut;
        }
        attendance.workedMinutes = calculateWorkedMinutes(attendance.sessions);
        attendance.isRegularized = true;
        await this.attRepo.save(attendance);
      }
    }

    return request;
  }
}