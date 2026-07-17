import { Router } from "express";
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

import { requireCompleteProfile } from "./profile-completion.middleware";

const router = Router();
const controller = new EmployeeController();

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
  checkPermission("employee.read"),
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