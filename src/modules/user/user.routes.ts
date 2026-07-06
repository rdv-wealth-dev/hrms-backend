import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { AssignRoleDto } from "./user.dto";

const router = Router();
const controller = new UserController();

router.use(authenticate);

router.get(
    "/",
    checkPermission("role.read"),
    controller.listUsers.bind(controller)
);

router.get(
    "/:id",
    checkPermission("role.read"),
    controller.getById.bind(controller)
)

router.patch(
    "/:id/role",
    checkPermission("role.update"),
    validateBody(AssignRoleDto),
    controller.assignRole.bind(controller)
);

export default router;