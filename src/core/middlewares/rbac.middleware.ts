import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError, ForbiddenPermissionError } from "../errors/app.error";
import { RequestContext } from "../interfaces/request-context.interface";
import { RoleModel } from "../../modules/role/role.model";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

// Check permission
// Usage: router.get("/", authenticate, checkPermission("employee.read"), controller)
export const checkPermission = (requiredPermission: string) => {
  return async (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { role, tenantId } = req.context;

      if (role === "ORG_ADMIN") {
        next();
        return;
      }

      const roleDoc = await RoleModel.findOne({
        tenantId:  new mongoose.Types.ObjectId(tenantId),
        slug:      role,
        isActive:  true,
        isDeleted: false,
      }).select("permissions");

      const permissions = roleDoc?.permissions ?? [];

      if (!permissions.includes(requiredPermission)) {
        next(ForbiddenPermissionError(
          `Access denied. Required permission: ${requiredPermission}`
        ));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check role
// Usage: router.post("/", authenticate, checkRole("HR_ADMIN"), controller)
export const checkRole = (...allowedRoles: string[]) => {
  return (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const { role } = req.context;

    if (!allowedRoles.includes(role)) {
      next(
        new AppError(
          `Access denied. Allowed roles: ${allowedRoles.join(", ")}`,
          403
        )
      );
      return;
    }

    next();
  };
};

// Check branch access
// Verifies user has access to the branchId in req.params or req.body
export const checkBranchAccess = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  const { branchIds, role } = req.context;

  // Org admin has access to all branches
  if (role === "ORG_ADMIN" || !branchIds || branchIds.length === 0) {
    next();
    return;
  }

  // Get branchId from params or body
  const requestedBranchId = String(
    req.params.branchId ?? req.body.branchId ?? ""
  );

  if (!requestedBranchId) {
    next();
    return;
  }

  if (!branchIds.includes(requestedBranchId)) {
    next(new AppError("Access denied to this branch", 403));
    return;
  }

  next();
};