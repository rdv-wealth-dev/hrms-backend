import { Router } from "express";
import { AuditController } from "./audit.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";

const router = Router();
const ctrl = new AuditController();
router.use(authenticate);

router.get(
    "/sessions",
    checkPermission("role.read"),
    ctrl.getSessions.bind(ctrl)
);

router.get(
    "/actions",
    checkPermission("role.read"),
    ctrl.getActions.bind(ctrl)
);

export default router;