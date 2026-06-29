import { Router } from "express";
import { OrganizationController } from "./organization.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody }  from "../../core/validators/validate.middleware";
import {UpdateOrganizationDto, UpdateModulesDto, UpdateStatutoryDto,} from "./organization.dto";

const router     = Router();
const controller = new OrganizationController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/organizations/me
router.get(
  "/me",
  checkPermission("settings.read"),
  controller.getMe.bind(controller)
);

// PATCH /api/v1/organizations/me
router.patch(
  "/me",
  checkPermission("settings.update"),
  validateBody(UpdateOrganizationDto),
  controller.updateMe.bind(controller)
);

// PATCH /api/v1/organizations/me/modules
router.patch(
  "/me/modules",
  checkPermission("settings.update"),
  validateBody(UpdateModulesDto),
  controller.updateModules.bind(controller)
);

// PATCH /api/v1/organizations/me/statutory
router.patch(
  "/me/statutory",
  checkPermission("settings.update"),
  validateBody(UpdateStatutoryDto),
  controller.updateStatutory.bind(controller)
);

export default router;