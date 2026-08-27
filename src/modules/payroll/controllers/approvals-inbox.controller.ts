import { Request, Response, NextFunction } from "express";
import { ApprovalsInboxService } from "../services/approvals-inbox.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const approvalsInboxService = new ApprovalsInboxService();

export class ApprovalsInboxController {
  // GET /api/v1/payroll/approvals?type=PAYROLL_RUN|LOAN|REIMBURSEMENT|ARREARS_BATCH|ADJUSTMENT
  async getApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filterType = req.query.type as string | undefined;
      const result = await approvalsInboxService.getConsolidatedApprovals(req.context!, filterType);
      res.status(200).json(buildSuccessResponse(result, "Consolidated payroll approvals retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }
}
