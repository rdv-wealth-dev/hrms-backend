import { Request, Response, NextFunction } from "express";
import { Form16Service } from "../services/form16.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";
import { AppError } from "../../../shared/errors/app.error";

const form16Service = new Form16Service();

export class Form16Controller {
  // GET /api/v1/payroll/statutory/form16?employeeId=...&financialYear=2026-2027
  async getForm16(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = (req.query.employeeId as string) || req.context?.employeeId;
      if (!employeeId) {
        throw new AppError("employeeId query parameter is required", 400);
      }

      const financialYear = req.query.financialYear as string | undefined;
      const result = await form16Service.generateForm16(req.context!, employeeId, financialYear);

      res.status(200).json(buildSuccessResponse(result, "Form 16 annual tax certificate generated successfully"));
    } catch (e) {
      next(e);
    }
  }
}
