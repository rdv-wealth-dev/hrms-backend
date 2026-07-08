import mongoose from "mongoose";
import { CompOffRepository } from "./comp-off.repository";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { UserModel } from "../user/user.model";
import { EmployeeModel } from "../employee/employee.model";

const COMP_OFF_EXPIRY_DAYS = 90;   // configurable later if needed per-tenant

export class CompOffService {
  private compOffRepo = new CompOffRepository();

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

  // Credited by HR when an employee is confirmed to have worked a
  // holiday/weekly-off — not self-service, since it requires verification
  // (e.g. against attendance records showing they actually punched in that day).
  async creditCompOff(
    context: RequestContext,
    input: { employeeId: string; workDate: string; sourceType: string }
  ) {
    const employee = await EmployeeModel.findById(input.employeeId).select("branchId");
    if (!employee) throw new AppError("Employee not found", 404);

    const workDate = new Date(input.workDate);
    const expiryDate = new Date(workDate.getTime() + COMP_OFF_EXPIRY_DAYS * 86400000);

    return this.compOffRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(input.employeeId) as any,
      workDate,
      sourceType: input.sourceType as any,
      creditedDate: new Date(),
      expiryDate,
      status: "AVAILABLE" as any,
    });
  }

  async getMyCompOffs(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    return this.compOffRepo.findAvailableForEmployee(context, employeeId);
  }
}