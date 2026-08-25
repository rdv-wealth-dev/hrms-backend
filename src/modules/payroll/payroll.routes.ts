import { Router } from "express";
import { PayrollController } from "./controllers/payroll.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import { validateBody } from "../../shared/validators/validate.middleware";
import { heavyActionLimiter } from "../../shared/middlewares/rate-limiter.middleware";
import {
  CreateSalaryComponentDto, UpdateSalaryComponentDto,
  CreateSalaryStructureDto, CreatePayrollRunDto, ApprovePayrollRunDto,
  AttendanceLockDto, AttendanceUnlockDto,
  RejectOTDto,
  UpsertPTConfigDto, UpsertLWFConfigDto, UpsertOTConfigDto,
  TaxDeclarationDto,
  CreatePayrollAdjustmentDto, BulkCreatePayrollAdjustmentDto, RejectAdjustmentDto,
  UpsertPayrollGLConfigDto,
  CreateSalaryStructureTemplateDto, UpdateSalaryStructureTemplateDto, AssignStructureBulkDto,
  SaveWageInputsDto, SaveSalaryHoldDto, SaveTaxOverrideDto, BatchGeneratePayslipsDto,
  CreatePayslipTemplateDto, UpdatePayslipTemplateDto, SetPayslipTemplateDto,
  CreateBankPayoutConfigDto, UpdateBankPayoutConfigDto,
} from "./dto/payroll.dto";
import { PayrollCalendarPolicyController } from "./controllers/payroll-calendar-policy.controller";
import { UpsertPayrollCalendarPolicyDto } from "./dto/payroll-calendar-policy.dto";
import { LoanController } from "./controllers/loan.controller";

import {
  injectOnboardingStatus,
  requireProfileForRestrictedFeature,
} from "../employee/middlewares/profile-completion.middleware";

const router = Router();
const ctrl = new PayrollController();
const calendarPolicyCtrl = new PayrollCalendarPolicyController();
const loanCtrl = new LoanController();

router.use(authenticate);
// Stamps req.context with onboarding phase. Never blocks on its own.
// Self-service payslip and tax-declaration routes are individually gated below.
router.use(injectOnboardingStatus);

// Self-service — blocked at Day 8+ until profile is complete.
// Payslips require bank details and tax info to be meaningful/accurate.
router.get(
  "/payslips/me",
  requireProfileForRestrictedFeature("payslip downloads"),
  ctrl.getMyPayslips.bind(ctrl)
);

router.get(
  "/payslips/me/:id",
  requireProfileForRestrictedFeature("payslip downloads"),
  ctrl.getMyPayslipById.bind(ctrl)
);

// Admin: Filterable Payslip Directory (Branch, Year, Month, Employee)
router.get(
  "/payslips",
  checkPermission("payroll.read"),
  ctrl.listPayslips.bind(ctrl)
);

router.get(
  "/payslips/:id",
  checkPermission("payroll.read"),
  ctrl.getAdminPayslipById.bind(ctrl)
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


// ── Attendance Lock 
// HR locks attendance period before payroll can run
// Unlock blocked if payroll already paid for that period

router.post(
  ["/attendance-lock/lock", "/attendance-locks/lock"],
  checkPermission("payroll.run"),
  validateBody(AttendanceLockDto),
  ctrl.lockAttendance.bind(ctrl)
);

router.post(
  ["/attendance-lock/unlock", "/attendance-locks/unlock"],
  checkPermission("payroll.run"),
  validateBody(AttendanceUnlockDto),
  ctrl.unlockAttendance.bind(ctrl)
);

router.get(
  ["/attendance-lock/status/:year/:month", "/attendance-locks/status/:year/:month", "/attendance-locks/:year/:month", "/attendance-lock/:year/:month"],
  checkPermission("payroll.read"),
  ctrl.getAttendanceLockStatus.bind(ctrl)
);

router.get(
  ["/attendance-lock/year/:year", "/attendance-locks/year/:year", "/attendance-locks/year/:year"],
  checkPermission("payroll.read"),
  ctrl.listAttendanceLocksByYear.bind(ctrl)
);

// ── Pre-flight Validation 
// Run before generate — surfaces per-employee errors HR must fix first

router.post(
  "/runs/:id/validate",
  checkPermission("payroll.run"),
  ctrl.validateRun.bind(ctrl)
);

// ── Overtime 
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

// ── Statutory Config — PT slabs 
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

// ── Statutory Config — LWF 

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

// ── Statutory Config — OT Rules 

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

// ── Tax Declaration — Employee self-service 
// Employee submits once per year, can revise before proof deadline.
// Blocked at Day 8+ — tax declaration requires bank + identity details to be
// present and accurate before it can be acted upon by payroll.
// No permission check — employees access their own declaration only.

router.post(
  "/tax-declaration",
  requireProfileForRestrictedFeature("tax declarations"),
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

// ── Step 3: Variable & Ad-Hoc Adjustments 

router.post(
  "/adjustments",
  checkPermission("payroll.create"),
  validateBody(CreatePayrollAdjustmentDto),
  ctrl.createAdjustment.bind(ctrl)
);

router.post(
  "/adjustments/bulk",
  checkPermission("payroll.create"),
  validateBody(BulkCreatePayrollAdjustmentDto),
  ctrl.bulkCreateAdjustments.bind(ctrl)
);

router.get(
  "/adjustments",
  checkPermission("payroll.read"),
  ctrl.listAdjustments.bind(ctrl)
);

router.get(
  "/adjustments/:id",
  checkPermission("payroll.read"),
  ctrl.getAdjustmentById.bind(ctrl)
);

router.patch(
  "/adjustments/:id/approve",
  checkPermission("payroll.approve"),
  ctrl.approveAdjustment.bind(ctrl)
);

router.patch(
  "/adjustments/:id/reject",
  checkPermission("payroll.approve"),
  validateBody(RejectAdjustmentDto),
  ctrl.rejectAdjustment.bind(ctrl)
);

router.delete(
  "/adjustments/:id",
  checkPermission("payroll.create"),
  ctrl.deleteAdjustment.bind(ctrl)
);

// ── Step 8: Period-over-Period Variance & Audit 

router.get(
  "/runs/:id/variance-report",
  checkPermission("payroll.read"),
  ctrl.getVarianceReport.bind(ctrl)
);

// ── Step 10: Bank Disbursement Exports 

router.get(
  "/runs/:id/disbursement/summary",
  checkPermission("payroll.read"),
  ctrl.getDisbursementSummary.bind(ctrl)
);

router.get(
  "/runs/:id/disbursement/download",
  checkPermission("payroll.run"),
  ctrl.downloadDisbursementFile.bind(ctrl)
);

// ── Step 12 & 14: Statutory Compliance & Returns 

router.get(
  "/runs/:id/statutory/epf-ecr",
  checkPermission("payroll.run"),
  ctrl.downloadEpfoEcr.bind(ctrl)
);

router.get(
  "/runs/:id/statutory/esic",
  checkPermission("payroll.run"),
  ctrl.downloadEsicReturn.bind(ctrl)
);

router.get(
  "/runs/:id/statutory/pt",
  checkPermission("payroll.read"),
  ctrl.getPtStatement.bind(ctrl)
);

router.get(
  "/runs/:id/statutory/tds",
  checkPermission("payroll.read"),
  ctrl.downloadTds24Q.bind(ctrl)
);

// ── Step 13: General Ledger Accounting 

router.get(
  "/gl-config",
  checkPermission("payroll.read"),
  ctrl.getGLConfig.bind(ctrl)
);

router.post(
  "/gl-config",
  checkPermission("payroll.create"),
  validateBody(UpsertPayrollGLConfigDto),
  ctrl.updateGLConfig.bind(ctrl)
);

router.get(
  "/runs/:id/gl-journal",
  checkPermission("payroll.read"),
  ctrl.getOrDownloadGLJournal.bind(ctrl)
);

// ── Step 14: Payroll Calendar Policy ──

router.get(
  "/calendar-policy",
  checkPermission("payroll.read"),
  calendarPolicyCtrl.getPolicy.bind(calendarPolicyCtrl)
);

router.post(
  "/calendar-policy",
  checkPermission("payroll.create"),
  validateBody(UpsertPayrollCalendarPolicyDto),
  calendarPolicyCtrl.upsertPolicy.bind(calendarPolicyCtrl)
);

router.put(
  "/calendar-policy",
  checkPermission("payroll.create"),
  validateBody(UpsertPayrollCalendarPolicyDto),
  calendarPolicyCtrl.upsertPolicy.bind(calendarPolicyCtrl)
);

router.get(
  "/calendar-policy/preview",
  checkPermission("payroll.read"),
  calendarPolicyCtrl.previewCycle.bind(calendarPolicyCtrl)
);

// ── Multi-Structure Blueprint Templates ──
router.get(
  "/structures/templates",
  checkPermission("payroll.read"),
  ctrl.listStructureTemplates.bind(ctrl)
);

router.post(
  "/structures/templates",
  checkPermission("payroll.create"),
  validateBody(CreateSalaryStructureTemplateDto),
  ctrl.createStructureTemplate.bind(ctrl)
);

router.patch(
  "/structures/templates/:id",
  checkPermission("payroll.create"),
  validateBody(UpdateSalaryStructureTemplateDto),
  ctrl.updateStructureTemplate.bind(ctrl)
);

router.delete(
  "/structures/templates/:id",
  checkPermission("payroll.create"),
  ctrl.deleteStructureTemplate.bind(ctrl)
);

router.post(
  "/structures/assign-bulk",
  checkPermission("payroll.create"),
  validateBody(AssignStructureBulkDto),
  ctrl.assignStructureBulk.bind(ctrl)
);

// ── 6-Step Controlled Payroll Run Pipeline ──
router.get(
  "/runs/:id/steps/attendance-sync",
  checkPermission("payroll.read"),
  ctrl.getAttendanceSyncStep.bind(ctrl)
);

router.post(
  "/runs/:id/steps/wage-inputs",
  checkPermission("payroll.create"),
  validateBody(SaveWageInputsDto),
  ctrl.saveWageInputsStep.bind(ctrl)
);

router.post(
  "/runs/:id/steps/hold-salary",
  checkPermission("payroll.create"),
  validateBody(SaveSalaryHoldDto),
  ctrl.saveSalaryHoldStep.bind(ctrl)
);

router.post(
  "/runs/:id/steps/tax-override",
  checkPermission("payroll.create"),
  validateBody(SaveTaxOverrideDto),
  ctrl.saveTaxOverrideStep.bind(ctrl)
);

router.post(
  "/runs/:id/generate-batch",
  checkPermission("payroll.run"),
  validateBody(BatchGeneratePayslipsDto),
  ctrl.generateBatchPayslips.bind(ctrl)
);

// ── Universal Bank Payout Exports ──
router.get(
  "/bank-formats",
  checkPermission("payroll.read"),
  ctrl.listBankFormats.bind(ctrl)
);

router.post(
  "/bank-formats",
  checkPermission("payroll.create"),
  validateBody(CreateBankPayoutConfigDto),
  ctrl.createBankFormat.bind(ctrl)
);

router.patch(
  "/bank-formats/:id",
  checkPermission("payroll.create"),
  validateBody(UpdateBankPayoutConfigDto),
  ctrl.updateBankFormat.bind(ctrl)
);

router.delete(
  "/bank-formats/:id",
  checkPermission("payroll.create"),
  ctrl.deleteBankFormat.bind(ctrl)
);

router.get(
  "/runs/:id/payout/export",
  checkPermission("payroll.run"),
  ctrl.exportBankPayoutFile.bind(ctrl)
);

// ── Statutory Compliance Returns ──
router.get(
  "/runs/:id/statutory/epfo-ecr-txt",
  checkPermission("payroll.run"),
  ctrl.downloadEpfoEcrText.bind(ctrl)
);

router.get(
  "/runs/:id/statutory/esic-csv",
  checkPermission("payroll.run"),
  ctrl.downloadEsicReturnCsv.bind(ctrl)
);

// ── Payslip Layout Customizer Templates ──
router.get(
  "/payslip-templates",
  checkPermission("payroll.read"),
  ctrl.listPayslipTemplates.bind(ctrl)
);

router.post(
  "/payslip-templates",
  checkPermission("payroll.create"),
  validateBody(CreatePayslipTemplateDto),
  ctrl.createPayslipTemplate.bind(ctrl)
);

router.patch(
  "/payslip-templates/:id",
  checkPermission("payroll.create"),
  validateBody(UpdatePayslipTemplateDto),
  ctrl.updatePayslipTemplate.bind(ctrl)
);

router.patch(
  "/payslip-templates/:id/set-default",
  checkPermission("payroll.create"),
  ctrl.setDefaultPayslipTemplateById.bind(ctrl)
);

router.delete(
  "/payslip-templates/:id",
  checkPermission("payroll.create"),
  ctrl.deletePayslipTemplate.bind(ctrl)
);

router.post(
  "/payslip-templates/default",
  checkPermission("payroll.create"),
  validateBody(SetPayslipTemplateDto),
  ctrl.setDefaultPayslipTemplate.bind(ctrl)
);

// ── Loans & Salary Advances ───────────────────────────────────────────────

router.get(
  "/loans/me",
  loanCtrl.getMyLoans.bind(loanCtrl)
);

router.post(
  "/loans",
  loanCtrl.create.bind(loanCtrl)
);

router.get(
  "/loans",
  checkPermission("payroll.read"),
  loanCtrl.list.bind(loanCtrl)
);

router.get(
  "/loans/:id",
  loanCtrl.getById.bind(loanCtrl)
);

router.patch(
  "/loans/:id",
  checkPermission("payroll.create"),
  loanCtrl.update.bind(loanCtrl)
);

router.patch(
  "/loans/:id/approve",
  checkPermission("payroll.approve"),
  loanCtrl.approve.bind(loanCtrl)
);

router.patch(
  "/loans/:id/reject",
  checkPermission("payroll.approve"),
  loanCtrl.reject.bind(loanCtrl)
);

router.delete(
  "/loans/:id",
  checkPermission("payroll.create"),
  loanCtrl.delete.bind(loanCtrl)
);

export default router;

