import { Request, Response, NextFunction } from "express";
import { SalaryComponentService } from "../services/salary-component.service";
import { SalaryStructureService } from "../services/salary-structure.service";
import { PayrollRunService } from "../services/payroll-run.service";
import { PayslipService } from "../services/payslip.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";
import { AttendanceLockService } from "../../attendance/services/attendance-lock.service";
import { OvertimeService } from "../services/overtime.service";
import { ProfessionalTaxService, LWFConfigService, OvertimeConfigService, TaxDeclarationService } from "../services/statutory-calculator.service";
import { PayrollAdjustmentService } from "../services/payroll-adjustment.service";
import { PayrollAuditService } from "../services/payroll-audit.service";
import { PayrollDisbursementService } from "../services/payroll-disbursement.service";
import { PayrollComplianceService } from "../services/payroll-compliance.service";
import { PayrollGLService } from "../services/payroll-gl.service";
import { SalaryStructureTemplateService } from "../services/salary-structure-template.service";
import { PayslipTemplateService } from "../services/payslip-template.service";
import { BankPayoutFormatService } from "../services/bank-payout-format.service";
import { EpfoEsicComplianceService } from "../services/epfo-esic-compliance.service";
import { BankPayoutConfigModel } from "../models/bank-payout-config.model";
import { PfEsiConfigModel } from "../models/statutory-config.model";
import { PayslipModel } from "../models/payslip.model";
import { PayrollRunModel } from "../models/payroll-run.model";

const componentService = new SalaryComponentService();
const structureService = new SalaryStructureService();
const runService = new PayrollRunService();
const payslipService = new PayslipService();
const lockService = new AttendanceLockService();
const otService = new OvertimeService();
const ptService = new ProfessionalTaxService();
const lwfService = new LWFConfigService();
const otConfigService = new OvertimeConfigService();
const taxDeclService = new TaxDeclarationService();
const adjustmentService = new PayrollAdjustmentService();
const auditService = new PayrollAuditService();
const disbursementService = new PayrollDisbursementService();
const complianceService = new PayrollComplianceService();
const glService = new PayrollGLService();
const structureTemplateService = new SalaryStructureTemplateService();
const payslipTemplateService = new PayslipTemplateService();

export class PayrollController {

  // ── Salary components ──
  async createComponent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await componentService.create(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Salary component created")
      );
    } catch (e) {
      next(e);
    }
  }

  async listComponents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await componentService.list(req.context);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  }

  async updateComponent(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await componentService.update(req.context, req.params.id, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Salary component updated")
      );
    } catch (e) {
      next(e);
    }
  }

  async deleteComponent(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await componentService.delete(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Salary component deleted")
      );
    } catch (e) {
      next(e);
    }
  }

  // ── Salary structure ──
  async createStructure(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await structureService.createOrRevise(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Salary structure created")
      );
    } catch (e) {
      next(e);
    }
  }

  async getStructure(
    req: Request<{ employeeId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await structureService.getActiveForEmployee(req.context, req.params.employeeId);
      res.status(200).json(
        buildSuccessResponse(result, "Salary structure fetched")
      );
    } catch (e) {
      next(e);
    }
  }

  // ── Payroll runs ──
  async createRun(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.createRun(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Payroll run created")
      );
    } catch (e) {
      next(e);
    }
  }

  async generatePayslips(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.generatePayslips(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payslips generated")
      );
    } catch (e) {
      next(e);
    }
  }

  async listRuns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const branchId = req.query.branchId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const status = req.query.status as string;

      const result = await runService.list(req.context!, page, pageSize, {
        branchId,
        year,
        month,
        status,
      });
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  }

  async getRun(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.getById(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payroll run fetched")
      );
    } catch (e) {
      next(e);
    }
  }

  async getRunPayslips(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.getPayslips(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payslips fetched")
      );
    } catch (e) {
      next(e);
    }
  }

  async approveRun(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.approve(req.context, req.params.id, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Payroll run approved")
      );
    } catch (e) {
      next(e);
    }
  }

  async markRunPaid(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.markPaid(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payroll run marked as paid")
      );
    } catch (e) {
      next(e);
    }
  }

  // ── Admin Payslips (Branch, Year, Month, Employee filters) ──
  async listPayslips(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const employeeId = req.query.employeeId as string;
      const branchId = req.query.branchId as string;

      const result = await payslipService.listPayslips(
        req.context!,
        { year, month, employeeId, branchId },
        page,
        pageSize
      );
      res.status(200).json(buildSuccessResponse(result, "Payslips fetched successfully"));
    } catch (e) {
      next(e);
    }
  }

  async getAdminPayslipById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await payslipService.getAdminPayslipById(req.context!, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payslip details fetched successfully")
      );
    } catch (e) {
      next(e);
    }
  }

  // ── Self-service payslips ──
  async getMyPayslips(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 12;
      const result = await payslipService.getMyPayslips(req.context, page, pageSize);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  }

  async getMyPayslipById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await payslipService.getMyPayslipById(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Payslip fetched")
      );
    } catch (e) {
      next(e);
    }
  }

  // ── Pre-flight Validation ─────────────────────────────────────────────────

  async validateRun(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await runService.validateRun(req.context!, req.params.id);
      res.status(200).json(
        buildSuccessResponse(
          result,
          result.valid
            ? "Pre-flight validation passed — ready to generate"
            : `Validation found ${result.errors.length} issue(s) — fix before generating`
        )
      );
    } catch (e) { next(e); }
  }

  // ── Attendance Lock ───────────────────────────────────────────────────────

  async lockAttendance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { year, month, branchId } = req.body;
      const result = await lockService.lockPeriod(
        req.context!, parseInt(year), parseInt(month), branchId
      );
      res.status(200).json(
        buildSuccessResponse(result, `Attendance locked for ${year}-${String(month).padStart(2, "0")}`)
      );
    } catch (e) { next(e); }
  }

  async unlockAttendance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { year, month, reason, branchId } = req.body;
      const result = await lockService.unlockPeriod(
        req.context!, parseInt(year), parseInt(month), reason, branchId
      );
      res.status(200).json(
        buildSuccessResponse(result, `Attendance unlocked for ${year}-${String(month).padStart(2, "0")}`)
      );
    } catch (e) { next(e); }
  }

  async getAttendanceLockStatus(
    req: Request<{ year: string; month: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branchId = req.query.branchId as string;
      const result = await lockService.getLockStatus(
        req.context!,
        parseInt(req.params.year),
        parseInt(req.params.month),
        branchId
      );
      res.status(200).json(buildSuccessResponse(result, "Lock status fetched"));
    } catch (e) { next(e); }
  }

  async listAttendanceLocksByYear(
    req: Request<{ year: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const branchId = req.query.branchId as string;
      const result = await lockService.listYearLocks(
        req.context!, parseInt(req.params.year), branchId
      );
      res.status(200).json(buildSuccessResponse(result, "Year lock statuses fetched"));
    } catch (e) { next(e); }
  }

  // ── Overtime ──────────────────────────────────────────────────────────────

  async listPendingOT(
    req: Request<{ year: string; month: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otService.listPending(
        req.context!,
        parseInt(req.params.year),
        parseInt(req.params.month)
      );
      res.status(200).json(buildSuccessResponse(result, "Pending OT records fetched"));
    } catch (e) { next(e); }
  }

  async listEmployeeOT(
    req: Request<{ employeeId: string; year: string; month: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otService.listForEmployee(
        req.context!,
        req.params.employeeId,
        parseInt(req.params.year),
        parseInt(req.params.month)
      );
      res.status(200).json(buildSuccessResponse(result, "OT records fetched"));
    } catch (e) { next(e); }
  }

  async approveOT(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otService.approve(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Overtime approved"));
    } catch (e) { next(e); }
  }

  async rejectOT(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reason } = req.body;
      const result = await otService.reject(req.context!, req.params.id, reason);
      res.status(200).json(buildSuccessResponse(result, "Overtime rejected"));
    } catch (e) { next(e); }
  }

  // ── Professional Tax Config ───────────────────────────────────────────────

  async listPTConfigs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const fy = req.query.financialYear as string | undefined;
      const result = await ptService.listConfigs(req.context!, fy);
      res.status(200).json(buildSuccessResponse(result, "PT configs fetched"));
    } catch (e) { next(e); }
  }

  async upsertPTConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await ptService.upsertConfig(req.context!, req.body);
      res.status(200).json(buildSuccessResponse(result, "PT config saved"));
    } catch (e) { next(e); }
  }

  async deletePTConfig(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await ptService.deleteConfig(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "PT config deleted"));
    } catch (e) { next(e); }
  }

  // ── LWF Config ────────────────────────────────────────────────────────────

  async listLWFConfigs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const fy = req.query.financialYear as string | undefined;
      const result = await lwfService.listConfigs(req.context!, fy);
      res.status(200).json(buildSuccessResponse(result, "LWF configs fetched"));
    } catch (e) { next(e); }
  }

  async upsertLWFConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await lwfService.upsertConfig(req.context!, req.body);
      res.status(200).json(buildSuccessResponse(result, "LWF config saved"));
    } catch (e) { next(e); }
  }

  // ── OT Config ─────────────────────────────────────────────────────────────

  async getOTConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otConfigService.getConfig(req.context!);
      res.status(200).json(buildSuccessResponse(result, "OT config fetched"));
    } catch (e) { next(e); }
  }

  async upsertOTConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otConfigService.upsertConfig(req.context!, req.body);
      res.status(200).json(buildSuccessResponse(result, "OT config saved"));
    } catch (e) { next(e); }
  }

  // ── Tax Declaration ───────────────────────────────────────────────────────

  async submitTaxDeclaration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Resolve employeeId from logged-in user
      const mongoose = require("mongoose");
      const { UserModel } = require("../user/user.model");
      const user = await UserModel.findOne({
        _id: new mongoose.Types.ObjectId(req.context!.userId),
        tenantId: new mongoose.Types.ObjectId(req.context!.tenantId),
      }).select("employeeId");

      if (!user?.employeeId) {
        res.status(404).json(
          buildSuccessResponse(null, "No employee record linked to this account")
        );
        return;
      }

      const result = await taxDeclService.submitOrRevise(
        req.context!,
        user.employeeId.toString(),
        req.body
      );
      res.status(200).json(buildSuccessResponse(result, "Tax declaration saved"));
    } catch (e) { next(e); }
  }

  async getTaxDeclaration(
    req: Request<{ financialYear: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const mongoose = require("mongoose");
      const { UserModel } = require("../user/user.model");
      const user = await UserModel.findOne({
        _id: new mongoose.Types.ObjectId(req.context!.userId),
        tenantId: new mongoose.Types.ObjectId(req.context!.tenantId),
      }).select("employeeId");

      if (!user?.employeeId) {
        res.status(404).json(
          buildSuccessResponse(null, "No employee record linked to this account")
        );
        return;
      }

      const result = await taxDeclService.getDeclaration(
        req.context!,
        user.employeeId.toString(),
        req.params.financialYear
      );
      res.status(200).json(buildSuccessResponse(result, "Tax declaration fetched"));
    } catch (e) { next(e); }
  }

  async markTaxProofSubmitted(
    req: Request<{ financialYear: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const mongoose = require("mongoose");
      const { UserModel } = require("../user/user.model");
      const user = await UserModel.findOne({
        _id: new mongoose.Types.ObjectId(req.context!.userId),
        tenantId: new mongoose.Types.ObjectId(req.context!.tenantId),
      }).select("employeeId");

      if (!user?.employeeId) {
        res.status(404).json(
          buildSuccessResponse(null, "No employee record linked to this account")
        );
        return;
      }

      const result = await taxDeclService.markProofSubmitted(
        req.context!,
        user.employeeId.toString(),
        req.params.financialYear
      );
      res.status(200).json(buildSuccessResponse(result, "Proof submission marked"));
    } catch (e) { next(e); }
  }

  // ── Step 3: Variable & Ad-Hoc Adjustments ──────────────────────────────────

  async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adjustmentService.create(req.context!, req.body);
      res.status(201).json(buildSuccessResponse(result, "Payroll adjustment created"));
    } catch (e) { next(e); }
  }

  async bulkCreateAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adjustmentService.bulkCreate(req.context!, req.body);
      res.status(201).json(buildSuccessResponse(result, "Bulk adjustments processed"));
    } catch (e) { next(e); }
  }

  async approveAdjustment(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adjustmentService.approve(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Payroll adjustment approved"));
    } catch (e) { next(e); }
  }

  async rejectAdjustment(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adjustmentService.reject(req.context!, req.params.id, req.body.reason);
      res.status(200).json(buildSuccessResponse(result, "Payroll adjustment rejected"));
    } catch (e) { next(e); }
  }

  async listAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const filter = {
        employeeId: req.query.employeeId as string,
        branchId: req.query.branchId as string,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        month: req.query.month ? parseInt(req.query.month as string) : undefined,
        status: req.query.status as string,
        type: req.query.type as string,
      };
      const result = await adjustmentService.list(req.context!, filter, page, pageSize);
      res.status(200).json(buildSuccessResponse(result, "Adjustments fetched"));
    } catch (e) { next(e); }
  }

  async getAdjustmentById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adjustmentService.getById(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Adjustment fetched"));
    } catch (e) { next(e); }
  }

  async deleteAdjustment(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await adjustmentService.delete(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(null, "Adjustment deleted"));
    } catch (e) { next(e); }
  }

  // ── Step 8: Period-over-Period Variance & Audit ───────────────────────────

  async getVarianceReport(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 5;
      const compareRunId = req.query.compareRunId as string;
      const result = await auditService.getVarianceAndAuditReport(req.context!, req.params.id, {
        thresholdPercent: threshold,
        compareRunId,
      });
      res.status(200).json(buildSuccessResponse(result, "Variance and audit report generated"));
    } catch (e) { next(e); }
  }

  // ── Step 10: Bank Disbursement Files ──────────────────────────────────────

  async getDisbursementSummary(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await disbursementService.getDisbursementSummary(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Disbursement summary generated"));
    } catch (e) { next(e); }
  }

  async downloadDisbursementFile(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as any) || "GENERIC_CSV";
      const fileData = await disbursementService.generateDisbursementFile(req.context!, req.params.id, format);
      res.setHeader("Content-Type", fileData.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
      res.send(fileData.content);
    } catch (e) { next(e); }
  }

  // ── Step 12 & 14: Statutory Compliance & Returns ─────────────────────────

  async downloadEpfoEcr(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileData = await complianceService.generateEpfoEcr(req.context!, req.params.id);
      res.setHeader("Content-Type", fileData.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
      res.send(fileData.content);
    } catch (e) { next(e); }
  }

  async downloadEsicReturn(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileData = await complianceService.generateEsicReturn(req.context!, req.params.id);
      res.setHeader("Content-Type", fileData.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
      res.send(fileData.content);
    } catch (e) { next(e); }
  }

  async getPtStatement(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await complianceService.generatePtStatement(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Professional Tax statement fetched"));
    } catch (e) { next(e); }
  }

  async downloadTds24Q(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileData = await complianceService.generateTds24QRegister(req.context!, req.params.id);
      res.setHeader("Content-Type", fileData.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
      res.send(fileData.content);
    } catch (e) { next(e); }
  }

  // ── Step 13: General Ledger Accounting ────────────────────────────────────

  async getGLConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await glService.getGLConfig(req.context!);
      res.status(200).json(buildSuccessResponse(result, "GL configuration fetched"));
    } catch (e) { next(e); }
  }

  async updateGLConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await glService.updateGLConfig(req.context!, req.body);
      res.status(200).json(buildSuccessResponse(result, "GL configuration updated"));
    } catch (e) { next(e); }
  }

  async getOrDownloadGLJournal(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as any) || "JSON";
      const result = await glService.generateGLJournal(req.context!, req.params.id, format);
      if (format === "CSV" || format === "TALLY_XML") {
        const fileData = result as { filename: string; contentType: string; content: string };
        res.setHeader("Content-Type", fileData.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
        res.send(fileData.content);
        return;
      }
      res.status(200).json(buildSuccessResponse(result, "GL journal generated"));
    } catch (e) { next(e); }
  }

  // ── Multi-Structure Blueprint Templates ───────────────────────────────────

  async listStructureTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await structureTemplateService.listTemplates(req.context!.tenantId);
      res.status(200).json(buildSuccessResponse(result, "Salary structure templates fetched"));
    } catch (e) { next(e); }
  }

  async createStructureTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await structureTemplateService.createTemplate(req.context!.tenantId, req.body);
      res.status(201).json(buildSuccessResponse(result, "Salary structure template created"));
    } catch (e) { next(e); }
  }

  async assignStructureBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templateId, employeeIds, annualCtc, effectiveFrom } = req.body;
      const result = await structureTemplateService.assignBulk(
        req.context!.tenantId,
        templateId,
        employeeIds,
        annualCtc,
        new Date(effectiveFrom)
      );
      res.status(200).json(buildSuccessResponse(result, "Structure assigned in bulk successfully"));
    } catch (e) { next(e); }
  }

  // ── 6-Step Controlled Payroll Run Pipeline ────────────────────────────────

  async getAttendanceSyncStep(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await runService.getById(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse({
        runId: run._id,
        wizardStep: (run as any).wizardStep || "ATTENDANCE",
        month: run.month,
        year: run.year,
        totalEmployees: run.totalEmployees,
      }, "Attendance synchronization step state"));
    } catch (e) { next(e); }
  }

  async saveWageInputsStep(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { wageInputs } = req.body;
      const run = await PayrollRunModel.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.context!.tenantId },
        {
          $set: {
            wageBasedInputs: wageInputs,
            wizardStep: "WAGES",
          },
        },
        { new: true }
      );
      res.status(200).json(buildSuccessResponse(run, "Wage and overtime inputs saved successfully"));
    } catch (e) { next(e); }
  }

  async saveSalaryHoldStep(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { holdList } = req.body;
      const run = await PayrollRunModel.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.context!.tenantId },
        {
          $set: {
            salaryOnHoldEmployees: holdList,
            wizardStep: "ON_HOLD",
          },
        },
        { new: true }
      );
      res.status(200).json(buildSuccessResponse(run, "Salary on-hold list updated successfully"));
    } catch (e) { next(e); }
  }

  async saveTaxOverrideStep(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { overrides } = req.body;
      const run = await PayrollRunModel.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.context!.tenantId },
        {
          $set: {
            manualTaxOverrides: overrides,
            wizardStep: "TAX_OVERRIDE",
          },
        },
        { new: true }
      );
      res.status(200).json(buildSuccessResponse(run, "Manual tax overrides saved successfully"));
    } catch (e) { next(e); }
  }

  async generateBatchPayslips(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await runService.generatePayslips(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Batch payslip generation complete"));
    } catch (e) { next(e); }
  }

  // ── Universal Bank Payout Exports ─────────────────────────────────────────

  async listBankFormats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const presets = BankPayoutFormatService.getAvailableFormats();
      const customConfigs = await BankPayoutConfigModel.find({
        tenantId: req.context!.tenantId,
        isActive: true,
      });
      res.status(200).json(buildSuccessResponse({ presets, customConfigs }, "Bank formats retrieved"));
    } catch (e) { next(e); }
  }

  async createBankFormat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await BankPayoutConfigModel.create({
        ...req.body,
        tenantId: req.context!.tenantId,
      });
      res.status(201).json(buildSuccessResponse(config, "Custom bank format saved successfully"));
    } catch (e) { next(e); }
  }

  async exportBankPayoutFile(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const bankCode = (req.query.bankCode as string) || "STANDARD_CSV";
      const configId = req.query.configId as string;

      const run = await PayrollRunModel.findOne({
        _id: req.params.id,
        tenantId: req.context!.tenantId,
      });
      if (!run) {
        res.status(404).json({ success: false, message: "Payroll run not found" });
        return;
      }

      const payslips = await PayslipModel.find({
        payrollRunId: run._id,
        tenantId: req.context!.tenantId,
      }).populate("employeeId");

      const records = BankPayoutFormatService.buildDisbursementRecords(run, payslips);

      let customConfig = null;
      if (configId) {
        customConfig = await BankPayoutConfigModel.findOne({
          _id: configId,
          tenantId: req.context!.tenantId,
          isActive: true,
        });
      } else {
        customConfig = await BankPayoutConfigModel.findOne({
          tenantId: req.context!.tenantId,
          bankCode: bankCode.toUpperCase(),
          isActive: true,
        });
      }

      const formatTarget = customConfig ? (customConfig.toObject() as any) : bankCode;
      const requestedFormat = (req.query.format as string || req.query.fileFormat as string || "").toLowerCase();

      if (requestedFormat === "xlsx") {
        const fileData = await BankPayoutFormatService.formatBankExportXlsx(records, formatTarget);
        res.setHeader("Content-Type", fileData.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
        res.send(fileData.fileBuffer);
        return;
      }

      const fileData = BankPayoutFormatService.formatBankExport(records, formatTarget);

      res.setHeader("Content-Type", fileData.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileData.filename}"`);
      res.send(fileData.fileContent);
    } catch (e) { next(e); }
  }

  // ── Statutory Compliance Returns ──────────────────────────────────────────

  async downloadEpfoEcrText(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await PayrollRunModel.findOne({
        _id: req.params.id,
        tenantId: req.context!.tenantId,
      });
      if (!run) {
        res.status(404).json({ success: false, message: "Payroll run not found" });
        return;
      }

      const payslips = await PayslipModel.find({
        payrollRunId: run._id,
        tenantId: req.context!.tenantId,
      }).populate("employeeId");

      const pfConfig = await PfEsiConfigModel.findOne({
        tenantId: req.context!.tenantId,
        isActive: true,
      });

      const fileContent = EpfoEsicComplianceService.generateEpfoEcrText(
        run,
        payslips,
        pfConfig ? (pfConfig.toObject() as any) : undefined
      );
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="EPFO_ECR_${run.month}_${run.year}.txt"`);
      res.send(fileContent);
    } catch (e) { next(e); }
  }

  async downloadEsicReturnCsv(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await PayrollRunModel.findOne({
        _id: req.params.id,
        tenantId: req.context!.tenantId,
      });
      if (!run) {
        res.status(404).json({ success: false, message: "Payroll run not found" });
        return;
      }

      const payslips = await PayslipModel.find({
        payrollRunId: run._id,
        tenantId: req.context!.tenantId,
      }).populate("employeeId");

      const esiConfig = await PfEsiConfigModel.findOne({
        tenantId: req.context!.tenantId,
        isActive: true,
      });

      const fileContent = EpfoEsicComplianceService.generateEsicReturnCsv(
        run,
        payslips,
        esiConfig ? (esiConfig.toObject() as any) : undefined
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ESIC_Monthly_Return_${run.month}_${run.year}.csv"`);
      res.send(fileContent);
    } catch (e) { next(e); }
  }

  // ── Payslip Layout Customizer ─────────────────────────────────────────────

  async listPayslipTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await payslipTemplateService.listTemplates(req.context!.tenantId);
      res.status(200).json(buildSuccessResponse(result, "Payslip templates fetched"));
    } catch (e) { next(e); }
  }

  async createPayslipTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await payslipTemplateService.createCustomTemplate(req.context!.tenantId, req.body);
      res.status(201).json(buildSuccessResponse(result, "Payslip template created successfully"));
    } catch (e) { next(e); }
  }

  async setDefaultPayslipTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templateCode } = req.body;
      const result = await payslipTemplateService.setDefaultFormat(req.context!.tenantId, templateCode);
      res.status(200).json(buildSuccessResponse(result, `Default payslip layout set to ${templateCode}`));
    } catch (e) { next(e); }
  }
}