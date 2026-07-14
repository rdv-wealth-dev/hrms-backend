import { Router } from "express";
import { EmployeeController } from "./employee.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
  AddBankAccountDto,
  AddDocumentDto,
  RequestUploadUrlDto
} from "./employee.dto";

const router = Router();
const controller = new EmployeeController();

router.use(authenticate);

router.get(
  "/me",
  controller.getMyProfile.bind(controller)
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

//Bank accounts
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

router.get(
  "/me/bank-accounts",
  controller.getMyBankAccounts.bind(controller)
);

//Documents
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

router.delete(
  "/:id/documents/:docId",
  checkPermission("employee.update"),
  controller.deleteDocument.bind(controller)
);
router.get(
  "/me/documents",
  controller.getMyDocuments.bind(controller)
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