import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { EmployeeController } from "./controllers/employee.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import { validateBody } from "../../shared/validators/validate.middleware";
import { uploadSingleFile, uploadCsvOrExcel } from "../../shared/middlewares/upload.middleware";
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
  AddBankAccountDto,
} from "./dto/employee.dto";
import { UserModel } from "../user/user.model";
import { RoleModel } from "../role/role.model";
import { AppError } from "../../shared/errors/app.error";

import { requireCompleteProfile } from "./middlewares/profile-completion.middleware";

const router = Router();
const controller = new EmployeeController();

// Owner (self) OR admin with employee.read may view the full profile.
// This lets employees open their own complete-profile without admin perms.
async function authorizeCompleteProfile(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, tenantId, role } = req.context;

    // Org-level admins can view any profile
    if (["SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "LEADERSHIP"].includes(role)) {
      next();
      return;
    }

    // Admin case — has employee.read permission
    const roleDoc = await RoleModel.findOne({
      tenantId:  new mongoose.Types.ObjectId(tenantId),
      slug:      role,
      isActive:  true,
      isDeleted: false,
    }).select("permissions");

    if (roleDoc?.permissions?.includes("employee.read")) {
      next();
      return;
    }

    // Owner case — user is viewing their own employee record
    const user = await UserModel.findOne({
      _id: userId,
      tenantId,
    }).select("employeeId");

    if (user?.employeeId && user.employeeId.toString() === req.params.id) {
      next();
      return;
    }

    next(new AppError("You are not authorized to view this profile.", 403));
  } catch (error) {
    next(error);
  }
}

router.use(authenticate);
router.use(requireCompleteProfile);

router.get(
  "/me",
  controller.getMyProfile.bind(controller)
)

router.patch(
  "/me",
  validateBody(UpdateEmployeeDto),
  controller.updateMyProfile.bind(controller)
)

//Core employee CRUD
router.get(
  "/",
  checkPermission("employee.read"),
  controller.list.bind(controller)
);

router.post(
  "/",
  checkPermission("employee.create"),
  validateBody(CreateEmployeeDto),
  controller.create.bind(controller)
);

// Calendar events — static path, must be before /:id
router.get(
  "/events",
  checkPermission("employee.read"),
  controller.getCalendarEvents.bind(controller)
);

// Bulk Import & Export — static paths, must be before /:id
router.post(
  "/bulk-import",
  checkPermission("employee.create"),
  uploadCsvOrExcel("file"),
  controller.importEmployees.bind(controller)
);

router.get(
  "/bulk-export",
  checkPermission("employee.read"),
  controller.exportEmployees.bind(controller)
);

// GET /api/v1/employees/import-template?format=xlsx
router.get(
  "/import-template",
  checkPermission("employee.read"),
  controller.downloadImportTemplate.bind(controller)
);

// Preview-Before-Commit Import endpoints
router.post(
  "/import/validate",
  checkPermission("employee.create"),
  uploadCsvOrExcel("file"),
  controller.validateImport.bind(controller)
);

router.get(
  "/import/:sessionId/preview",
  checkPermission("employee.read"),
  controller.getImportPreview.bind(controller)
);

router.post(
  "/import/:sessionId/commit",
  checkPermission("employee.create"),
  controller.commitImport.bind(controller)
);

router.get(
  "/audit/import-export-history",
  checkPermission("employee.read"),
  controller.getImportExportHistory.bind(controller)
);

router.get(
  "/:id",
  checkPermission("employee.read"),
  controller.getById.bind(controller)
);

router.get(
  "/:id/complete-profile",
  authorizeCompleteProfile,
  controller.getCompleteProfile.bind(controller)
);

router.patch(
  "/:id",
  checkPermission("employee.update"),
  validateBody(UpdateEmployeeDto),
  controller.update.bind(controller)
);

router.patch(
  "/:id/status",
  checkPermission("employee.update"),
  validateBody(UpdateEmployeeStatusDto),
  controller.updateStatus.bind(controller)
);

router.delete(
  "/:id",
  checkPermission("employee.delete"),
  controller.delete.bind(controller)
);

// ── Self-service routes (no permission needed, must be BEFORE /:id) ──

router.get(
  "/me/bank-accounts",
  controller.getMyBankAccounts.bind(controller)
);

router.post(
  "/me/bank-accounts",
  validateBody(AddBankAccountDto),
  controller.addMyBankAccount.bind(controller)
);

router.delete(
  "/me/bank-accounts/:bankId",
  controller.deleteMyBankAccount.bind(controller)
);


router.patch(
  "/me/avatar",
  uploadSingleFile("avatar"),
  controller.uploadMyAvatar.bind(controller)
);



// ── Admin: bank accounts (require permissions) ──

router.get(
  "/:id/bank-accounts",
  checkPermission("employee.read"),
  controller.getBankAccounts.bind(controller)
);

router.post(
  "/:id/bank-accounts",
  checkPermission("employee.update"),
  validateBody(AddBankAccountDto),
  controller.addBankAccount.bind(controller)
);

router.delete(
  "/:id/bank-accounts/:bankId",
  checkPermission("employee.update"),
  controller.deleteBankAccount.bind(controller)
);


router.patch(
  "/:id/avatar",
  checkPermission("employee.update"),
  uploadSingleFile("avatar"),
  controller.uploadAvatar.bind(controller)
);


export default router;