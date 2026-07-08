import { Router } from "express";
import { LeaveTypeController } from "./leave-type.controller";
import { LeaveRequestController } from "./leave-request.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import {
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateLeaveRequestDto,
  ReviewLeaveRequestDto,
  CancelLeaveRequestDto,
} from "./leave.dto";
import { HolidayController } from "./holiday.controller";
import { CreateHolidayDto, UpdateHolidayDto } from "./leave.dto";

const router = Router();
const typeCtrl = new LeaveTypeController();
const requestCtrl = new LeaveRequestController();
const holidayCtrl = new HolidayController();

router.use(authenticate);

// SELF-SERVICE — authenticate only, same pattern as employees/me and attendance/me

router.post(
  "/requests",
  validateBody(CreateLeaveRequestDto),
  requestCtrl.create.bind(requestCtrl)
);

router.get("/requests/me", requestCtrl.getMyRequests.bind(requestCtrl));
router.get("/balances/me", requestCtrl.getMyBalances.bind(requestCtrl));

router.patch(
  "/requests/:id/cancel",
  validateBody(CancelLeaveRequestDto),
  requestCtrl.cancel.bind(requestCtrl)
);

// MANAGER / HR — approval queue and review

router.get(
  "/requests/pending",
  checkPermission("leave.approve"),
  requestCtrl.getPending.bind(requestCtrl)
);

router.patch(
  "/requests/:id/review",
  checkPermission("leave.approve"),
  validateBody(ReviewLeaveRequestDto),
  requestCtrl.review.bind(requestCtrl)
);

router.get(
  "/report",
  checkPermission("leave.read"),
  requestCtrl.getReport.bind(requestCtrl)
);

// LEAVE TYPES — HR admin configuration

router.get(
  "/types",
  checkPermission("leave.read"),
  typeCtrl.list.bind(typeCtrl)
);

router.post(
  "/types",
  checkPermission("leave.create"),
  validateBody(CreateLeaveTypeDto),
  typeCtrl.create.bind(typeCtrl)
);

router.get(
  "/types/:id",
  checkPermission("leave.read"),
  typeCtrl.getById.bind(typeCtrl)
);

router.patch(
  "/types/:id",
  checkPermission("leave.update"),
  validateBody(UpdateLeaveTypeDto),
  typeCtrl.update.bind(typeCtrl)
);

router.delete(
  "/types/:id",
  checkPermission("leave.update"),
  typeCtrl.delete.bind(typeCtrl)
);


//Holidays
router.get(
  "/holidays",
  checkPermission("leave.read"),
  holidayCtrl.list.bind(holidayCtrl)
);

router.post(
  "/holidays",
  checkPermission("leave.create"),
  validateBody(CreateHolidayDto),
  holidayCtrl.create.bind(holidayCtrl)
);

router.get(
  "/holidays/:id",
  checkPermission("leave.read"),
  holidayCtrl.getById.bind(holidayCtrl)
);

router.patch(
  "/holidays/:id",
  checkPermission("leave.update"),
  validateBody(UpdateHolidayDto),
  holidayCtrl.update.bind(holidayCtrl)
);

router.delete(
  "/holidays/:id",
  checkPermission("leave.update"),
  holidayCtrl.delete.bind(holidayCtrl)
);


//Comp-off
router.post(
  "/comp-off",
  checkPermission("leave.create"),
  holidayCtrl.creditCompOff.bind(holidayCtrl)
);

router.get(
  "/comp-off/me",
  holidayCtrl.getMyCompOffs.bind(holidayCtrl)
);

export default router;