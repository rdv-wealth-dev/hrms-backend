import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { UserModel } from "../../modules/user/user.model";
import { EmployeeModel } from "../../modules/employee/employee.model";
import { AppError } from "../../core/errors/app.error";
import { ErrorCode } from "../../core/errors/error-codes";

// Blocks dashboard/self-service routes until the employee's profile is
// complete. Never blocks SUPER_ADMIN/HR — they have no employeeId anyway
// or shouldn't be gated by this. Never blocks the routes needed to
// actually complete the profile (those are explicitly whitelisted below).
const EXEMPT_PATHS = [
  "/api/v1/employees/me",              // GET + PATCH — needed to fill in details
  "/api/v1/employees/me/documents",    // upload flow
  "/api/v1/employees/me/bank-accounts",
  "/api/v1/auth/logout",
  "/api/v1/profile/me",                // so frontend can show a "complete your profile" screen
];

export const requireCompleteProfile = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (EXEMPT_PATHS.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }

    const { role, userId, tenantId } = req.context;

    // Admin roles never gated by employee profile completion
    if (["SUPER_ADMIN", "HR_ADMIN", "LEADERSHIP", "MANAGER", "PRODUCT_MANAGER", "BRANCH_ADMIN"].includes(role)) {
      next();
      return;
    }

    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).select("employeeId");

    if (!user?.employeeId) {
      next();
      return;
    }

    const employee = await EmployeeModel.findById(user.employeeId).select("isProfileComplete profileCompletion");

    if (employee && !employee.isProfileComplete) {
      next(new AppError(
        "Please complete your profile (personal details, address, emergency contact, bank account, and required documents) before accessing this feature.",
        403,
        ErrorCode.FORBIDDEN_PERMISSION,
      ));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};