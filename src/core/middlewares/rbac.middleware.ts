import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error";

// Check permission
// Usage: router.get("/", authenticate, checkPermission("employee.read"), controller)

export const checkPermission = (requiredPermission: string) => {
    return (
        req : Request,
        _res : Response,
        next : NextFunction
    ): void => {
        const { permissions, role } = req.context!;

        if(role === "SUPER_ADMIN"){
            next()
            return;
        }

        if(!permissions.includes(requiredPermission)){
            next(
                new AppError(
                    `Access Denied. Required permission: ${requiredPermission}`,
                    403
                )
            );
            return;
        }
        next();
    }
};

// ─── Check role ───────────────────────────────────────────────────────────────
// Usage: router.post("/", authenticate, checkRole("HR_ADMIN"), controller)
export const checkRole = (...allowedRoles: string[]) => {
  return (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const { role } = req.context!;

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

// ─── Check branch access ──────────────────────────────────────────────────────
// Verifies user has access to the branchId in req.params or req.body
export const checkBranchAccess = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  const { branchIds, role } = req.context!;

  // Super admin has access to all branches
  if (role === "SUPER_ADMIN" || !branchIds || branchIds.length === 0) {
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
}