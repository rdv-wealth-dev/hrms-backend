import { Request, Response, NextFunction } from "express";
import { FnFSettlementService } from "../services/fnf-settlement.service";
import {
  ComputeFnFDto,
  ProcessFnFDto,
  FnFQueryDto,
} from "../dto/fnf-settlement.dto";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const fnfService = new FnFSettlementService();

export class FnFSettlementController {
  // GET /api/v1/payroll/fnf/:employeeId/compute?lastWorkingDay=YYYY-MM-DD
  async computeSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
      const input = ComputeFnFDto.parse(req.query);
      const result = await fnfService.computeSettlement(req.context!, employeeId, input);
      res.status(200).json(buildSuccessResponse(result, "Full & Final settlement computed successfully"));
    } catch (e) {
      next(e);
    }
  }

  // POST /api/v1/payroll/fnf/:employeeId/process
  async processSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
      const input = ProcessFnFDto.parse(req.body);
      const result = await fnfService.processSettlement(req.context!, employeeId, input);
      res.status(201).json(buildSuccessResponse(result, "Full & Final settlement finalized and processed successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/fnf
  async listSettlements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = FnFQueryDto.parse(req.query);
      const result = await fnfService.listSettlements(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Full & Final settlements retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/fnf/:id
  async getSettlementById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await fnfService.getSettlementById(req.context!, id);
      res.status(200).json(buildSuccessResponse(result, "FnF settlement details retrieved"));
    } catch (e) {
      next(e);
    }
  }
}
