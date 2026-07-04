import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { ShiftController } from "./shift.controller";
import { RegularizationController } from "./regularization.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import {
    PunchDto,
    ManualAttendanceDto,
    CreateShiftDto,
    UpdateShiftDto,
    CreateRegularizationDto,
    ReviewRegularizationDto
} from "./attendance.dto"

const router = Router();
const attCtrl = new AttendanceController();
const shiftCtrl = new ShiftController();
const regCtrl = new RegularizationController();

router.use(authenticate);

// SELF-SERVICE — no permission check, only authentication.
// Every authenticated user with a linked employeeId can punch their own attendance and see their own history

router.post(
    "/me/punch/web",
    validateBody(PunchDto),
    attCtrl.punchWeb.bind(attCtrl)
);

router.post(
  "/me/punch/mobile",
  validateBody(PunchDto),
  attCtrl.punchMobile.bind(attCtrl)
);

router.get("/me/today",   attCtrl.getMyToday.bind(attCtrl));
router.get("/me/history", attCtrl.getMyHistory.bind(attCtrl));

router.post(
  "/regularizations",
  validateBody(CreateRegularizationDto),
  regCtrl.create.bind(regCtrl)
);
router.get("/regularizations/me", regCtrl.getMyRequests.bind(regCtrl));

// ADMIN / HR / MANAGER — permission-gated

router.post(
  "/manual",
  checkPermission("attendance.create"),
  validateBody(ManualAttendanceDto),
  attCtrl.manualEntry.bind(attCtrl)
);

router.get(
  "/report",
  checkPermission("attendance.read"),
  attCtrl.getReport.bind(attCtrl)
);


router.get(
  "/regularizations/pending",
  checkPermission("leave.approve"),   // reuse approve-style permission
  regCtrl.getPending.bind(regCtrl)
);

router.patch(
  "/regularizations/:id/review",
  checkPermission("leave.approve"),
  validateBody(ReviewRegularizationDto),
  regCtrl.review.bind(regCtrl)
);

//Shifts (HR admin)

router.get(
  "/shifts",
  checkPermission("attendance.read"),
  shiftCtrl.list.bind(shiftCtrl)
);

router.post(
  "/shifts",
  checkPermission("attendance.create"),
  validateBody(CreateShiftDto),
  shiftCtrl.create.bind(shiftCtrl)
);

router.get(
  "/shifts/:id",
  checkPermission("attendance.read"),
  shiftCtrl.getById.bind(shiftCtrl)
);

router.patch(
  "/shifts/:id",
  checkPermission("attendance.update"),
  validateBody(UpdateShiftDto),
  shiftCtrl.update.bind(shiftCtrl)
);

router.delete(
  "/shifts/:id",
  checkPermission("attendance.update"),
  shiftCtrl.delete.bind(shiftCtrl)
);

export default router;