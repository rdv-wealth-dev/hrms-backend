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

import { injectOnboardingStatus } from "./middlewares/profile-completion.middleware";
import { EmployeeDocumentController } from "../employee-document/employee-document.controller";
import { AddDocumentDto, RequestUploadUrlDto, UploadDocumentDto } from "../employee-document/employee-document.dto";

const router = Router();
const controller = new EmployeeController();
const docController = new EmployeeDocumentController();

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
// Inject onboarding phase into context for all employee routes.
// No blocking here — /me, /me/documents, /me/bank-accounts are the completion
// routes themselves and must always remain open to all employees.
router.use(injectOnboardingStatus);

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

// Employee Documents (Self-Service)
router.get(
  "/me/documents",
  docController.getMyDocuments.bind(docController)
);
router.post(
  "/me/documents",
  validateBody(AddDocumentDto),
  docController.addMyDocument.bind(docController)
);
router.delete(
  "/me/documents/:docId",
  docController.deleteMyDocument.bind(docController)
);
router.post(
  "/me/documents/upload-url",
  validateBody(RequestUploadUrlDto),
  docController.requestMyUploadUrl.bind(docController)
);
router.get(
  "/me/documents/:docId/download-url",
  docController.getMyDownloadUrl.bind(docController)
);
router.post(
  "/me/documents/upload",
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  docController.uploadMyDocumentDirectly.bind(docController)
);

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

// ── Admin: Employee Documents (Gated by permissions) ──
router.get(
  "/:id/documents",
  checkPermission("employee.read"),
  docController.getDocuments.bind(docController)
);
router.post(
  "/:id/documents",
  checkPermission("employee.update"),
  validateBody(AddDocumentDto),
  docController.addDocument.bind(docController)
);
router.delete(
  "/:id/documents/:docId",
  checkPermission("employee.update"),
  docController.deleteDocument.bind(docController)
);
router.post(
  "/:id/documents/upload-url",
  checkPermission("employee.update"),
  validateBody(RequestUploadUrlDto),
  docController.requestUploadUrl.bind(docController)
);
router.get(
  "/:id/documents/:docId/download-url",
  checkPermission("employee.read"),
  docController.getDownloadUrl.bind(docController)
);
router.post(
  "/:id/documents/upload",
  checkPermission("employee.update"),
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  docController.uploadDocumentDirectly.bind(docController)
);

export default router;