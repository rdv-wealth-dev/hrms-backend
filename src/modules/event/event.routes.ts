import { Router } from "express";
import { EventController } from "./event.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { checkRole } from "../../core/middlewares/rbac.middleware";
import { CreateEventDto } from "./event.dto";

const router = Router();
const controller = new EventController();

router.use(authenticate);

// GET /api/v1/events
router.get("/", controller.list.bind(controller));

// POST /api/v1/events (restricted to Admins only)
router.post(
  "/",
  checkRole("ORG_ADMIN", "BRANCH_ADMIN", "HR_ADMIN"),
  validateBody(CreateEventDto),
  controller.create.bind(controller)
);

export default router;
