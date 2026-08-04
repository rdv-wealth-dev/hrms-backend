import { Router } from "express";
import { EmployeeDocumentController } from "./employee-document.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import { validateBody } from "../../shared/validators/validate.middleware";
import { uploadSingleFile } from "../../shared/middlewares/upload.middleware";
import { requireCompleteProfile } from "../employee/middlewares/profile-completion.middleware";
import {
  AddDocumentDto,
  RequestUploadUrlDto,
  VerifyDocumentDto,
  UploadDocumentDto,
} from "./employee-document.dto";

const router = Router();
const controller = new EmployeeDocumentController();

router.use(authenticate);
router.use(requireCompleteProfile);

// ── Self-Service (My Profile/Documents) ──

router.get(
  "/me",
  controller.getMyDocuments.bind(controller)
);

router.post(
  "/me",
  validateBody(AddDocumentDto),
  controller.addMyDocument.bind(controller)
);

router.delete(
  "/me/:docId",
  controller.deleteMyDocument.bind(controller)
);

router.post(
  "/me/upload-url",
  validateBody(RequestUploadUrlDto),
  controller.requestMyUploadUrl.bind(controller)
);

router.get(
  "/me/:docId/download-url",
  controller.getMyDownloadUrl.bind(controller)
);

router.post(
  "/me/upload",
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  controller.uploadMyDocumentDirectly.bind(controller)
);

// ── Admin: Verification Queues ──

router.get(
  "/verification/pending",
  checkPermission("employee.update"),
  controller.getPendingDocuments.bind(controller)
);

router.patch(
  "/:docId/verify",
  checkPermission("employee.update"),
  validateBody(VerifyDocumentDto),
  controller.verifyDocument.bind(controller)
);

// ── Admin: Operations Gated by Employee Permissions ──

router.get(
  "/:employeeId",
  checkPermission("employee.read"),
  controller.getDocuments.bind(controller)
);

router.post(
  "/:employeeId",
  checkPermission("employee.update"),
  validateBody(AddDocumentDto),
  controller.addDocument.bind(controller)
);

router.delete(
  "/:employeeId/:docId",
  checkPermission("employee.update"),
  controller.deleteDocument.bind(controller)
);

router.post(
  "/:employeeId/upload-url",
  checkPermission("employee.update"),
  validateBody(RequestUploadUrlDto),
  controller.requestUploadUrl.bind(controller)
);

router.get(
  "/:employeeId/:docId/download-url",
  checkPermission("employee.read"),
  controller.getDownloadUrl.bind(controller)
);

router.post(
  "/:employeeId/upload",
  checkPermission("employee.update"),
  uploadSingleFile("file"),
  validateBody(UploadDocumentDto),
  controller.uploadDocumentDirectly.bind(controller)
);

export default router;
