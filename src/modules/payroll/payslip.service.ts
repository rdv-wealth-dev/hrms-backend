import mongoose from "mongoose";
import { PayslipRepository } from "./payslip.repository";
import { UserModel } from "../user/user.model";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class PayslipService {
  private payslipRepo = new PayslipRepository();

  private async resolveOwnEmployeeId(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId");
    if (!user?.employeeId) throw new AppError("No employee record is linked to this account", 404);
    return user.employeeId.toString();
  }

  async getMyPayslips(context: RequestContext, page: number, pageSize: number) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    return this.payslipRepo.findForEmployee(context, employeeId, page, pageSize);
  }

  async getMyPayslipById(context: RequestContext, id: string) {
    const employeeId = await this.resolveOwnEmployeeId(context);
    const payslip = await this.payslipRepo.findById(context, id);
    if (!payslip) throw new AppError("Payslip not found", 404);
    if (payslip.employeeId.toString() !== employeeId) {
      throw new AppError("You can only view your own payslips", 403);
    }
    return payslip;
  }
}
