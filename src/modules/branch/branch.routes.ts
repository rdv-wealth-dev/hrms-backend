import { Router } from "express";
import { BranchController } from "./branch.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { CreateBranchDto, UpdateBranchDto } from "./branch.dto";

const router = Router();
const controller = new BranchController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/branches/head-office
// Must be before /:id to avoid conflict
router.get(
  "/head-office",
  checkPermission("branch.read"),
  controller.getHeadOffice.bind(controller)
);

// GET /api/v1/branches
router.get(
  "/",
  checkPermission("branch.read"),
  controller.list.bind(controller)
);

// POST /api/v1/branches
router.post(
  "/",
  checkPermission("branch.create"),
  validateBody(CreateBranchDto),
  controller.create.bind(controller)
);

// GET /api/v1/branches/:id
router.get(
  "/:id",
  checkPermission("branch.read"),
  controller.getById.bind(controller)
);

// PATCH /api/v1/branches/:id
router.patch(
  "/:id",
  checkPermission("branch.update"),
  validateBody(UpdateBranchDto),
  controller.update.bind(controller)
);

// DELETE /api/v1/branches/:id
router.delete(
  "/:id",
  checkPermission("branch.update"),
  controller.delete.bind(controller)
);

export default router;