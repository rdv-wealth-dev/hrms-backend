"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBranchAccess = exports.checkRole = exports.checkPermission = void 0;
const app_error_1 = require("../errors/app.error");
// Check permission
// Usage: router.get("/", authenticate, checkPermission("employee.read"), controller)
const checkPermission = (requiredPermission) => {
    return (req, _res, next) => {
        const { permissions, role } = req.context;
        if (role === "SUPER_ADMIN") {
            next();
            return;
        }
        if (!permissions.includes(requiredPermission)) {
            next(new app_error_1.AppError(`Access Denied. Required permission: ${requiredPermission}`, 403));
            return;
        }
        next();
    };
};
exports.checkPermission = checkPermission;
// ─── Check role ───────────────────────────────────────────────────────────────
// Usage: router.post("/", authenticate, checkRole("HR_ADMIN"), controller)
const checkRole = (...allowedRoles) => {
    return (req, _res, next) => {
        const { role } = req.context;
        if (!allowedRoles.includes(role)) {
            next(new app_error_1.AppError(`Access denied. Allowed roles: ${allowedRoles.join(", ")}`, 403));
            return;
        }
        next();
    };
};
exports.checkRole = checkRole;
// ─── Check branch access ──────────────────────────────────────────────────────
// Verifies user has access to the branchId in req.params or req.body
const checkBranchAccess = (req, _res, next) => {
    const { branchIds, role } = req.context;
    // Super admin has access to all branches
    if (role === "SUPER_ADMIN" || !branchIds || branchIds.length === 0) {
        next();
        return;
    }
    // Get branchId from params or body
    const requestedBranchId = String(req.params.branchId ?? req.body.branchId ?? "");
    if (!requestedBranchId) {
        next();
        return;
    }
    if (!branchIds.includes(requestedBranchId)) {
        next(new app_error_1.AppError("Access denied to this branch", 403));
        return;
    }
};
exports.checkBranchAccess = checkBranchAccess;
//# sourceMappingURL=rbac.middleware.js.map