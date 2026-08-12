import { Request, Response, NextFunction } from "express";
import { PayrollCalendarPolicyService } from "../services/payroll-calendar-policy.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";
import { PreviewCalendarCycleDto } from "../dto/payroll-calendar-policy.dto";

const policyService = new PayrollCalendarPolicyService();

export class PayrollCalendarPolicyController {
  async getPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await policyService.getPolicy(req.context!);
      res.status(200).json(buildSuccessResponse(result, "Payroll calendar policy fetched successfully"));
    } catch (e) {
      next(e);
    }
  }

  async upsertPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await policyService.upsertPolicy(req.context!, req.body);
      res.status(200).json(buildSuccessResponse(result, "Payroll calendar policy updated successfully"));
    } catch (e) {
      next(e);
    }
  }

  async previewCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = PreviewCalendarCycleDto.safeParse(req.query);
      const now = new Date();
      const year = parsed.success ? parsed.data.year : now.getFullYear();
      const month = parsed.success ? parsed.data.month : now.getMonth() + 1;

      const policy = await policyService.getPolicy(req.context!);
      const result = policyService.calculateCycleDates(policy, year, month);

      res.status(200).json(buildSuccessResponse(result, `Payroll cycle preview generated for ${result.period}`));
    } catch (e) {
      next(e);
    }
  }
}
