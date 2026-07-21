import { Router } from "express";
import { BranchController } from "./branch.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { CreateBranchDto, UpdateBranchDto } from "./branch.dto";
import {
  getBranchCalendar,
  getMyBranchCalendar,
  getMyPersonalSchedule,
} from "./calendar.controller";

const router = Router();
const controller = new BranchController();

// All routes require authentication
router.use(authenticate);

// CALENDAR — self-service (must be before /:id to avoid param collision) ───

// GET /api/v1/branches/my/calendar?year=&month=
// Returns the branch-level working/off calendar for the calling employee's branch
router.get("/my/calendar", getMyBranchCalendar);

// GET /api/v1/branches/me/schedule?year=&month=
// Returns a personal, rotation-aware schedule for the calling employee
router.get("/me/schedule", getMyPersonalSchedule);

// BRANCH MANAGEMENT 

// GET /api/v1/branches/head-office  (must remain before /:id)
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

// GET /api/v1/branches/:branchId/calendar?year=&month=
// Returns branch-level calendar (accessible to all auth users for that tenant)
router.get(
  "/:branchId/calendar",
  getBranchCalendar
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
