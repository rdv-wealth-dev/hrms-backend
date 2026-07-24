import { Router } from "express";
import { PayrollController } from "./payroll.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { checkPermission } from "../../core/middlewares/rbac.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import { heavyActionLimiter } from "../../core/middlewares/rate-limiter.middleware";
import {
    CreateSalaryComponentDto, UpdateSalaryComponentDto,
    CreateSalaryStructureDto, CreatePayrollRunDto, ApprovePayrollRunDto,
} from "./payroll.dto";

import { requireCompleteProfile } from "../employee/profile-completion.middleware";

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


export default router;