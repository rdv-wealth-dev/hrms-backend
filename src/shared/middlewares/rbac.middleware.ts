import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError, ForbiddenPermissionError } from "../errors/app.error";
import { RequestContext } from "../types/request-context.interface";
import { RoleModel } from "../../modules/role/role.model";
import { EmployeeModel } from "../../modules/employee/models/employee.model";
import { DEFAULT_ROLES } from "../../database/seeds/role.seed";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

// Master Org Admin roles that bypass granular permission checks
const MASTER_ADMIN_ROLES = ["ORG_ADMIN", "SUPER_ADMIN"];

/**
 * Validates that the requesting user has the required permission.
 * Usage: router.get("/", authenticate, checkPermission("employee.read"), controller.getEmployees)
 */
export const checkPermission = (requiredPermission: string) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { role, tenantId } = req.context;

      // Master admins have unrestricted access
      if (MASTER_ADMIN_ROLES.includes(role)) {
        next();
        return;
      }

      const roleDoc = await RoleModel.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        slug: role,
        isActive: true,
        isDeleted: false,
      }).select("permissions");

      let permissions = roleDoc?.permissions ?? [];

      // Fallback: If system role document in database is missing a newly added system permission,
      // fallback to DEFAULT_ROLES system blueprint
      if (!permissions.includes(requiredPermission)) {
        const defaultRole = DEFAULT_ROLES.find((r) => r.slug === role);
        if (defaultRole && defaultRole.permissions.includes(requiredPermission)) {
          permissions = defaultRole.permissions;
        }
      }

      if (!permissions.includes(requiredPermission)) {
        next(
          ForbiddenPermissionError(
            `Access denied. Required permission: ${requiredPermission}`
          )
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validates that the requesting user's role is in the allowed list.
 * Usage: router.post("/run", authenticate, checkRole("ORG_ADMIN", "HR_ADMIN", "CFO"), controller.runPayroll)
 */
export const checkRole = (...allowedRoles: string[]) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const { role } = req.context;

    if (MASTER_ADMIN_ROLES.includes(role) || allowedRoles.includes(role)) {
      next();
      return;
    }

    next(
      new AppError(
        `Access denied. Allowed roles: ${allowedRoles.join(", ")}`,
        403
      )
    );
  };
};

/**
 * Checks branch access scoping.
 * Ensures BRANCH_ADMIN or location managers can only operate within their assigned branchIds.
 */
export const checkBranchAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { branchIds, role } = req.context;

  // Org admins and roles with access to all branches bypass this check
  if (MASTER_ADMIN_ROLES.includes(role) || role === "HR_ADMIN" || role === "CEO" || !branchIds || branchIds.length === 0) {
    next();
    return;
  }

  const requestedBranchId = String(
    req.params.branchId ?? req.body.branchId ?? req.query.branchId ?? ""
  );

  if (!requestedBranchId) {
    next();
    return;
  }

  if (!branchIds.includes(requestedBranchId)) {
    next(new AppError("Access denied: You do not have access to this branch location", 403));
    return;
  }

  next();
};

/**
 * Checks if the requesting user is the target employee themselves, their direct manager, or an HR/Org admin.
 * Useful for leave approvals, attendance regularizations, and profile views.
 */
export const checkManagerOrSelf = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role, userId, tenantId, employeeId } = req.context;

    // Admins have full access
    if (MASTER_ADMIN_ROLES.includes(role) || ["HR_ADMIN", "CEO", "COO"].includes(role)) {
      next();
      return;
    }

    const targetEmployeeId = String(
      req.params.employeeId ?? req.params.id ?? req.body.employeeId ?? ""
    );

    if (!targetEmployeeId || !mongoose.Types.ObjectId.isValid(targetEmployeeId)) {
      next();
      return;
    }

    const currentEmpId = employeeId || userId;

    // Self access
    if (targetEmployeeId === currentEmpId) {
      next();
      return;
    }

    // Direct manager check
    const targetEmp = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(targetEmployeeId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false,
    }).select("managerId branchId");

    if (targetEmp && targetEmp.managerId && targetEmp.managerId.toString() === currentEmpId) {
      next();
      return;
    }

    next(new AppError("Access denied: You can only access your own or direct report data", 403));
  } catch (error) {
    next(error);
  }
};