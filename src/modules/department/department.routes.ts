import { Router } from "express";
import { DepartmentController }  from "./department.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import { validateBody } from "../../shared/validators/validate.middleware";
import { CreateDepartmentDto, UpdateDepartmentDto, } from "./department.dto";

const router = Router();
const controller = new DepartmentController();

router.use(authenticate);

router.get(
  "/",
  checkPermission("department.read"),
  controller.list.bind(controller)
);

router.post(
  "/",
  checkPermission("department.create"),
  validateBody(CreateDepartmentDto),
  controller.create.bind(controller)
);

router.post(
  "/seed",
  checkPermission("department.create"),
  controller.seed.bind(controller)
);

router.get(
  "/:id",
  checkPermission("department.read"),
  controller.getById.bind(controller)
);


router.patch(
  "/:id",
  checkPermission("department.update"),
  validateBody(UpdateDepartmentDto),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  checkPermission("department.update"),
  controller.delete.bind(controller)
);

export default router;