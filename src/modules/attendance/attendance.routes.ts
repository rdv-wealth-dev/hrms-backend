import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { ShiftController } from "./shift.controller";
import { RegularizationController } from "./regularization.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import {
  PunchDto, ManualAttendanceDto, CreateShiftDto, UpdateShiftDto, CreateRegularizationDto,
  ReviewRegularizationDto,
} from "./attendance.dto";
import { AssignShiftDto } from "./shift-assignment.dto";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AttendanceSummaryService } from "./attendance-summary.service";
import { closeOutAttendanceForDate } from "./attendance-closeout.job";
import { UserModel } from "../user/user.model";
import { AppError } from "../../core/errors/app.error";

import { requireCompleteProfile } from "../employee/profile-completion.middleware";

const router = Router();
const attCtrl = new AttendanceController();
const shiftCtrl = new ShiftController();
const regCtrl = new RegularizationController();
const summaryService = new AttendanceSummaryService();

router.use(authenticate);
router.use(requireCompleteProfile);

// ─── SELF-SERVICE (no permission check, auth only)

router.post("/me/punch/web",
  validateBody(PunchDto),
  attCtrl.punchWeb.bind(attCtrl)  
);

router.post("/me/punch/mobile",
  validateBody(PunchDto),
  attCtrl.punchMobile.bind(attCtrl)
);

router.get("/me/today",
  attCtrl.getMyToday.bind(attCtrl)
);

router.get("/me/history",
  attCtrl.getMyHistory.bind(attCtrl)
);


// Regularization (self-service)
router.post("/regularizations",
  validateBody(CreateRegularizationDto),
  regCtrl.create.bind(regCtrl)
);

router.get("/regularizations/me",
  regCtrl.getMyRequests.bind(regCtrl)
);

// ADMIN / HR / MANAGER — permission-gated

// Manual entry
router.post("/manual",
  checkPermission("attendance.create"),
  validateBody(ManualAttendanceDto),
  attCtrl.manualEntry.bind(attCtrl)
);

router.get(
  "/shifts/assignments",
  checkPermission("attendance.read"),
  shiftCtrl.getAssignments.bind(shiftCtrl)
);

// GET /api/v1/attendance/summary/:employeeId?year=2026&month=6
router.get(
  "/summary/:employeeId",
  checkPermission("attendance.read"),
  async (req: any, res, next) => {
    try {
      const { year, month } = req.query;
      const result = await summaryService.getMonthlySummary(
        req.context, req.params.employeeId,
        parseInt(year as string), parseInt(month as string)
      );
      res.status(200).json(buildSuccessResponse(result, "Monthly summary fetched"));
    } catch (error) { next(error); }
  }
);


// My own summary — self-service
router.get(
  "/summary/me/:year/:month",
  async (req: any, res, next) => {
    try {
      const user = await UserModel.findOne({ _id: req.context.userId }).select("employeeId");
      if (!user?.employeeId) throw new AppError("No employee linked", 404);
      const result = await summaryService.getMonthlySummary(
        req.context, user.employeeId.toString(),
        parseInt(req.params.year), parseInt(req.params.month)
      );
      res.status(200).json(buildSuccessResponse(result, "Your monthly summary"));
    } catch (error) { next(error); }
  }
);

// POST /api/v1/attendance/closeout  (admin-triggered, or wire to a real cron later)
router.post(
  "/closeout",
  checkPermission("attendance.update"),
  async (req: any, res, next) => {
    try {
      const date = req.body.date ? new Date(req.body.date) : new Date(Date.now() - 86400000);
      const result = await closeOutAttendanceForDate(req.context.tenantId, date);
      res.status(200).json(buildSuccessResponse(result, "Attendance closeout completed"));
    } catch (error) { next(error); }
  }
);

router.post(
  "/shifts/assign",
  checkPermission("attendance.update"),
  validateBody(AssignShiftDto),
  shiftCtrl.assignShift.bind(shiftCtrl)
);

// Main attendance report
router.get("/report",
  checkPermission("attendance.read"),
  attCtrl.getReport.bind(attCtrl)
);

// Utility routes for checking and cleaning orphaned attendance records
router.get("/orphaned-records/check",
  checkPermission("attendance.read"),
  attCtrl.checkOrphanedRecords.bind(attCtrl)
);
router.post("/orphaned-records/clean",
  checkPermission("attendance.update"),
  attCtrl.cleanOrphanedRecords.bind(attCtrl)
);

//REGULARIZATIONS

router.get("/regularizations/pending",
  checkPermission("attendance.approve"),
  regCtrl.getPending.bind(regCtrl)
);
router.patch("/regularizations/:id/review",
  checkPermission("attendance.approve"),
  validateBody(ReviewRegularizationDto),
  regCtrl.review.bind(regCtrl)
);

//SHIFTS

router.get("/shifts",
  checkPermission("attendance.read"),
  shiftCtrl.list.bind(shiftCtrl)
);

router.post("/shifts",
  checkPermission("attendance.create"),
  validateBody(CreateShiftDto),
  shiftCtrl.create.bind(shiftCtrl)
);

router.get("/shifts/:id",
  checkPermission("attendance.read"),
  shiftCtrl.getById.bind(shiftCtrl)
);

router.patch("/shifts/:id",
  checkPermission("attendance.update"),
  validateBody(UpdateShiftDto),
  shiftCtrl.update.bind(shiftCtrl)
);

router.delete("/shifts/:id",
  checkPermission("attendance.update"),
  shiftCtrl.delete.bind(shiftCtrl)
);


export default router;
