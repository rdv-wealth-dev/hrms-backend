import { Request, Response, NextFunction } from "express";
import { ReimbursementService } from "../services/reimbursement.service";
import {
  CreateReimbursementDto,
  UpdateReimbursementDto,
  ApproveReimbursementDto,
  RejectReimbursementDto,
  ReimbursementQueryDto,
} from "../dto/reimbursement.dto";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const reimbursementService = new ReimbursementService();

export class ReimbursementController {
  // POST /api/v1/payroll/reimbursements
  async createClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateReimbursementDto.parse(req.body);
      const result = await reimbursementService.createClaim(req.context!, input);
      res.status(201).json(buildSuccessResponse(result, "Reimbursement claim submitted successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/reimbursements
  async listClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ReimbursementQueryDto.parse(req.query);
      const result = await reimbursementService.listClaims(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Reimbursement claims retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/reimbursements/me
  async getMyClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ReimbursementQueryDto.parse(req.query);
      const result = await reimbursementService.getMyClaims(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Your reimbursement claims retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/reimbursements/:id
  async getClaimById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await reimbursementService.getClaimById(req.context!, id);
      res.status(200).json(buildSuccessResponse(result, "Reimbursement claim details retrieved"));
    } catch (e) {
      next(e);
    }
  }

  // PATCH /api/v1/payroll/reimbursements/:id/approve
  async approveClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = ApproveReimbursementDto.parse(req.body);
      const result = await reimbursementService.approveClaim(req.context!, id, input);
      res.status(200).json(buildSuccessResponse(result, "Reimbursement claim approved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // PATCH /api/v1/payroll/reimbursements/:id/reject
  async rejectClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = RejectReimbursementDto.parse(req.body);
      const result = await reimbursementService.rejectClaim(req.context!, id, input);
      res.status(200).json(buildSuccessResponse(result, "Reimbursement claim rejected"));
    } catch (e) {
      next(e);
    }
  }

  // DELETE /api/v1/payroll/reimbursements/:id
  async cancelClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await reimbursementService.cancelClaim(req.context!, id);
      res.status(200).json(buildSuccessResponse(result, "Reimbursement claim cancelled"));
    } catch (e) {
      next(e);
    }
  }
}
