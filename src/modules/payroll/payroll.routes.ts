import { Router } from "express";
import { PayrollController } from "./payroll.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { heavyActionLimiter } from "../../core/middlewares/rate-limiter.middleware";
import {
  CreateSalaryComponentDto, UpdateSalaryComponentDto,
  CreateSalaryStructureDto, CreatePayrollRunDto, ApprovePayrollRunDto,
  AttendanceLockDto, AttendanceUnlockDto,
  RejectOTDto,
  UpsertPTConfigDto, UpsertLWFConfigDto, UpsertOTConfigDto,
  TaxDeclarationDto,
} from "./payroll.dto";

import { requireCompleteProfile } from "../employee/profile/profile-completion.middleware";

const router = Router();
const ctrl = new PayrollController();

router.use(authenticate);
router.use(requireCompleteProfile);

// Self-service — no permission check
router.get(
    "/payslips/me",
    ctrl.getMyPayslips.bind(ctrl)
);

router.get(
    "/payslips/me/:id",
    ctrl.getMyPayslipById.bind(ctrl)
);

// Salary components (HR config)
router.get(
    "/components",
    checkPermission("payroll.read"),
    ctrl.listComponents.bind(ctrl)
);

router.post(
    "/components",
    checkPermission("payroll.create"),
    validateBody(CreateSalaryComponentDto),
    ctrl.createComponent.bind(ctrl)
);

router.patch(
    "/components/:id",
    checkPermission("payroll.create"),
    validateBody(UpdateSalaryComponentDto),
    ctrl.updateComponent.bind(ctrl)
);

router.delete(
    "/components/:id",
    checkPermission("payroll.create"),
    ctrl.deleteComponent.bind(ctrl)
);

// Salary structure
router.post(
    "/structures",
    checkPermission("payroll.create"),
    validateBody(CreateSalaryStructureDto),
    ctrl.createStructure.bind(ctrl)
);

router.get(
    "/structures/:employeeId",
    checkPermission("payroll.read"),
    ctrl.getStructure.bind(ctrl)
);

//Payroll runs
router.get(
    "/runs",
    checkPermission("payroll.read"),
    ctrl.listRuns.bind(ctrl)
);

router.post(
    "/runs",
    checkPermission("payroll.create"),
    validateBody(CreatePayrollRunDto),
    ctrl.createRun.bind(ctrl)
);

router.get(
    "/runs/:id",
    checkPermission("payroll.read"),
    ctrl.getRun.bind(ctrl)
);

router.post(
    "/runs/:id/generate",
    checkPermission("payroll.run"),
    heavyActionLimiter(2, 300), // Layer 3: max 2 generates per user per 5 min
    ctrl.generatePayslips.bind(ctrl)
);

router.get(
    "/runs/:id/payslips",
    checkPermission("payroll.read"),
    ctrl.getRunPayslips.bind(ctrl)
);

router.patch(
    "/runs/:id/approve",
    checkPermission("payroll.approve"),
    validateBody(ApprovePayrollRunDto),
    heavyActionLimiter(3, 300), // Layer 3: max 3 approvals per user per 5 min
    ctrl.approveRun.bind(ctrl)
);

router.patch(
    "/runs/:id/paid",
    checkPermission("payroll.approve"),
    ctrl.markRunPaid.bind(ctrl)
);


// ── Attendance Lock ───────────────────────────────────────────────────────
// HR locks attendance period before payroll can run
// Unlock blocked if payroll already paid for that period

router.post(
  "/attendance-lock/lock",
  checkPermission("payroll.run"),
  validateBody(AttendanceLockDto),
  ctrl.lockAttendance.bind(ctrl)
);

router.post(
  "/attendance-lock/unlock",
  checkPermission("payroll.run"),
  validateBody(AttendanceUnlockDto),
  ctrl.unlockAttendance.bind(ctrl)
);

router.get(
  "/attendance-lock/status/:year/:month",
  checkPermission("payroll.read"),
  ctrl.getAttendanceLockStatus.bind(ctrl)
);

router.get(
  "/attendance-lock/year/:year",
  checkPermission("payroll.read"),
  ctrl.listAttendanceLocksByYear.bind(ctrl)
);

// ── Pre-flight Validation ─────────────────────────────────────────────────
// Run before generate — surfaces per-employee errors HR must fix first

router.post(
  "/runs/:id/validate",
  checkPermission("payroll.run"),
  ctrl.validateRun.bind(ctrl)
);

// ── Overtime ──────────────────────────────────────────────────────────────
// Manager approves/rejects OT before payroll generates

router.get(
  "/overtime/pending/:year/:month",
  checkPermission("payroll.read"),
  ctrl.listPendingOT.bind(ctrl)
);

router.get(
  "/overtime/employee/:employeeId/:year/:month",
  checkPermission("payroll.read"),
  ctrl.listEmployeeOT.bind(ctrl)
);

router.patch(
  "/overtime/:id/approve",
  checkPermission("payroll.run"),
  ctrl.approveOT.bind(ctrl)
);

router.patch(
  "/overtime/:id/reject",
  checkPermission("payroll.run"),
  validateBody(RejectOTDto),
  ctrl.rejectOT.bind(ctrl)
);

// ── Statutory Config — PT slabs ───────────────────────────────────────────
// Finance team updates these annually when state revises slabs

router.get(
  "/statutory/pt",
  checkPermission("payroll.read"),
  ctrl.listPTConfigs.bind(ctrl)
);

router.post(
  "/statutory/pt",
  checkPermission("payroll.create"),
  validateBody(UpsertPTConfigDto),
  ctrl.upsertPTConfig.bind(ctrl)
);

router.delete(
  "/statutory/pt/:id",
  checkPermission("payroll.create"),
  ctrl.deletePTConfig.bind(ctrl)
);

// ── Statutory Config — LWF ────────────────────────────────────────────────

router.get(
  "/statutory/lwf",
  checkPermission("payroll.read"),
  ctrl.listLWFConfigs.bind(ctrl)
);

router.post(
  "/statutory/lwf",
  checkPermission("payroll.create"),
  validateBody(UpsertLWFConfigDto),
  ctrl.upsertLWFConfig.bind(ctrl)
);

// ── Statutory Config — OT Rules ───────────────────────────────────────────

router.get(
  "/statutory/ot-config",
  checkPermission("payroll.read"),
  ctrl.getOTConfig.bind(ctrl)
);

router.post(
  "/statutory/ot-config",
  checkPermission("payroll.create"),
  validateBody(UpsertOTConfigDto),
  ctrl.upsertOTConfig.bind(ctrl)
);

// ── Tax Declaration — Employee self-service ───────────────────────────────
// Employee submits once per year, can revise before proof deadline
// No permission check — employees access their own declaration only

router.post(
  "/tax-declaration",
  validateBody(TaxDeclarationDto),
  ctrl.submitTaxDeclaration.bind(ctrl)
);

router.get(
  "/tax-declaration/:financialYear",
  ctrl.getTaxDeclaration.bind(ctrl)
);

router.patch(
  "/tax-declaration/:financialYear/proof",
  ctrl.markTaxProofSubmitted.bind(ctrl)
);


export default router;