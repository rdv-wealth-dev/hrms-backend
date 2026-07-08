import mongoose from "mongoose";
import { LeaveBalanceRepository } from "./leave-balance.repository";
import { LeaveTypeRepository } from "./leave-type.repository";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import {
  calculateAccrualForPeriod,
  resolveEntitlementForBranch,
  recalculateAvailable,
} from "./leave.util";
import { EmployeeModel } from "../employee/employee.model";

export class LeaveBalanceService {
  private balanceRepo = new LeaveBalanceRepository();
  private leaveTypeRepo = new LeaveTypeRepository();

  // Gets (or lazily creates) an employee's balance for a leave type/year.
  // Created on first access rather than pre-seeded for every employee —
  // avoids a mass-write every time a new leave type is added.
  async getOrCreateBalance(
    context: RequestContext,
    employeeId: string,
    leaveTypeId: string,
    year: number
  ) {
    let balance = await this.balanceRepo.findOrNull(context, employeeId, leaveTypeId, year);
    if (balance) return balance;

    const leaveType = await this.leaveTypeRepo.findById(context, leaveTypeId);
    if (!leaveType) throw new AppError("Leave type not found", 404);

    const employee = await EmployeeModel.findById(employeeId).select("branchId joiningDate");
    if (!employee) throw new AppError("Employee not found", 404);

    const entitlement = resolveEntitlementForBranch(
      leaveType as any, employee.branchId.toString()
    );

    const fromDate = new Date(year, 0, 1) > employee.joiningDate
      ? new Date(year, 0, 1)
      : employee.joiningDate;

    const allocated = calculateAccrualForPeriod(
      { ...leaveType.toObject(), annualQuota: entitlement } as any,
      fromDate,
      new Date()
    );

    balance = await this.balanceRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      leaveTypeId: new mongoose.Types.ObjectId(leaveTypeId) as any,
      year,
      allocated,
      carriedForward: 0,
      used: 0,
      pending: 0,
      available: allocated,
    });

    return balance;
  }

  async getMyBalances(context: RequestContext, employeeId: string, year: number) {
    return this.balanceRepo.findAllForEmployee(context, employeeId, year);
  }

  // Called when a leave request is submitted — reserves days as "pending"
  async reserveDays(
    context: RequestContext,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
    allowNegative: boolean
  ) {
    const balance = await this.getOrCreateBalance(context, employeeId, leaveTypeId, year);

    if (!allowNegative && (balance.available - days) < 0) {
      throw new AppError(
        `Insufficient leave balance. Available: ${balance.available}, Requested: ${days}`,
        400
      );
    }

    balance.pending += days;
    balance.available = recalculateAvailable(balance);
    await this.balanceRepo.save(balance);
    return balance;
  }

  // Called on approval — moves days from "pending" to "used"
  async confirmUsage(
    context: RequestContext,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number
  ) {
    const balance = await this.getOrCreateBalance(context, employeeId, leaveTypeId, year);
    balance.pending = Math.max(0, balance.pending - days);
    balance.used += days;
    balance.available = recalculateAvailable(balance);
    await this.balanceRepo.save(balance);
    return balance;
  }

  // Called on rejection/cancellation — releases the pending reservation
  async releaseReservation(
    context: RequestContext,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number
  ) {
    const balance = await this.getOrCreateBalance(context, employeeId, leaveTypeId, year);
    balance.pending = Math.max(0, balance.pending - days);
    balance.available = recalculateAvailable(balance);
    await this.balanceRepo.save(balance);
    return balance;
  }
}
