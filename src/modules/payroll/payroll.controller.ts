import { Request, Response, NextFunction } from "express";
import { SalaryComponentService } from "./salary-component.service";
import { SalaryStructureService } from "./salary-structure.service";
import { PayrollRunService } from "./payroll-run.service";
import { PayslipService } from "./payslip.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const componentService = new SalaryComponentService();
const structureService = new SalaryStructureService();
const runService = new PayrollRunService();
const payslipService = new PayslipService();

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
}