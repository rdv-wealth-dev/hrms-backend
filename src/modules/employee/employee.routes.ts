import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { EmployeeController } from "./employee.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { uploadSingleFile } from "../../core/middlewares/upload.middleware";
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
  AddBankAccountDto,
  AddDocumentDto,
  RequestUploadUrlDto,
  VerifyDocumentDto,
  UploadDocumentDto
} from "./employee.dto";
import { UserModel } from "../user/user.model";
import { RoleModel } from "../role/role.model";
import { AppError } from "../../core/errors/app.error";

import { requireCompleteProfile } from "./profile-completion.middleware";

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

router.get(
  "/me/documents",
  controller.getMyDocuments.bind(controller)
);

router.delete(
  "/me/documents/:docId",
  controller.deleteMyDocument.bind(controller)
);

router.post(
  "/me/documents/upload-url", 
  validateBody(RequestUploadUrlDto), 
  controller.requestMyUploadUrl.bind(controller)
);

router.post(
  "/me/documents",            
  validateBody(AddDocumentDto),      
  controller.addMyDocument.bind(controller)
);

router.post(
  "/me/documents/upload",
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  controller.uploadMyDocumentDirectly.bind(controller)
);

router.get(
  "/me/documents/:docId/download-url",
  controller.getMyDownloadUrl.bind(controller)
);

// ── Admin: document verification (static paths before /:id) ──

router.get(
  "/documents/pending", 
  checkPermission("employee.update"), 
  controller.getPendingDocuments.bind(controller)
);

router.patch(
  "/documents/:docId/verify", 
  checkPermission("employee.update"), 
  validateBody(VerifyDocumentDto), 
  controller.verifyDocument.bind(controller)
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

// ── Admin: documents (require permissions) ──

router.get(
  "/:id/documents",
  checkPermission("employee.read"),
  controller.getDocuments.bind(controller)
);

router.post(
  "/:id/documents",
  checkPermission("employee.update"),
  validateBody(AddDocumentDto),
  controller.addDocument.bind(controller)
);

router.post(
  "/:id/documents/upload",
  checkPermission("employee.update"),
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  controller.uploadDocumentDirectly.bind(controller)
);

router.delete(
  "/:id/documents/:docId",
  checkPermission("employee.update"),
  controller.deleteDocument.bind(controller)
);

router.post(
  "/:id/documents/upload-url",
  checkPermission("employee.update"),
  validateBody(RequestUploadUrlDto),
  controller.requestUploadUrl.bind(controller)
);

router.get(
  "/:id/documents/:docId/download-url",
  checkPermission("employee.read"),
  controller.getDownloadUrl.bind(controller)
);

export default router;