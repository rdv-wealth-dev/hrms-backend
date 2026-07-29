import { Request, Response, NextFunction } from "express";
import { SalaryComponentService } from "./salary-components/salary-component.service";
import { SalaryStructureService } from "./salary-structures/salary-structure.service";
import { PayrollRunService } from "./payroll-run/payroll-run.service";
import { PayslipService } from "./payslip/payslip.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AttendanceLockService } from "../attendance/core/attendance-lock.service";
import { OvertimeService } from "./overtime.service";
import { ProfessionalTaxService, LWFConfigService, OvertimeConfigService, TaxDeclarationService } from "./statutory-config.service";

const componentService = new SalaryComponentService();
const structureService = new SalaryStructureService();
const runService = new PayrollRunService();
const payslipService = new PayslipService();
const lockService      = new AttendanceLockService();
const otService        = new OvertimeService();
const ptService        = new ProfessionalTaxService();
const lwfService       = new LWFConfigService();
const otConfigService  = new OvertimeConfigService();
const taxDeclService   = new TaxDeclarationService();

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
      const result = await runService.list(req.context, page, pageSize);
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
      const { year, month } = req.body;
      const result = await lockService.lockPeriod(
        req.context!, parseInt(year), parseInt(month)
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
      const { year, month, reason } = req.body;
      const result = await lockService.unlockPeriod(
        req.context!, parseInt(year), parseInt(month), reason
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
      const result = await lockService.getLockStatus(
        req.context!,
        parseInt(req.params.year),
        parseInt(req.params.month)
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
      const result = await lockService.listYearLocks(
        req.context!, parseInt(req.params.year)
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
      const fy     = req.query.financialYear as string | undefined;
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
      const fy     = req.query.financialYear as string | undefined;
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
        _id:      new mongoose.Types.ObjectId(req.context!.userId),
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
        _id:      new mongoose.Types.ObjectId(req.context!.userId),
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
        _id:      new mongoose.Types.ObjectId(req.context!.userId),
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
}