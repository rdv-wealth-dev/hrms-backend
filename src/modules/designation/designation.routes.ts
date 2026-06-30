import { Router } from "express";
import { DesignationController } from "./designation.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { CreateDesignationDto, UpdateDesignationDto, } from "./designation.dto";

const router = Router();
const controller = new DesignationController();

router.use(authenticate);

router.get(
  "/",
  checkPermission("designation.read"),
  controller.list.bind(controller)
);

router.post(
  "/",
  checkPermission("designation.create"),
  validateBody(CreateDesignationDto),
  controller.create.bind(controller)
);

router.get(
  "/:id",
  checkPermission("designation.read"),
  controller.getById.bind(controller)
);

router.patch(
  "/:id",
  checkPermission("designation.update"),
  validateBody(UpdateDesignationDto),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  checkPermission("designation.update"),
  controller.delete.bind(controller)
);

export default router;