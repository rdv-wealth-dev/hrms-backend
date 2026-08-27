import { Request, Response, NextFunction } from "express";
import { ArrearsBatchService } from "../services/arrears-batch.service";
import {
  CreateArrearsBatchDto,
  ProcessArrearsBatchDto,
  ArrearsBatchQueryDto,
} from "../dto/arrears-batch.dto";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const arrearsBatchService = new ArrearsBatchService();

export class ArrearsBatchController {
  // POST /api/v1/payroll/arrears/batches
  async createBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateArrearsBatchDto.parse(req.body);
      const result = await arrearsBatchService.createBatch(req.context!, input);
      res.status(201).json(buildSuccessResponse(result, "Arrears batch created successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/arrears/batches
  async listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ArrearsBatchQueryDto.parse(req.query);
      const result = await arrearsBatchService.listBatches(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Arrears batches retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/payroll/arrears/batches/:id
  async getBatchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await arrearsBatchService.getBatchById(req.context!, id);
      res.status(200).json(buildSuccessResponse(result, "Arrears batch details retrieved"));
    } catch (e) {
      next(e);
    }
  }

  // PATCH /api/v1/payroll/arrears/batches/:id/process
  async processBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = ProcessArrearsBatchDto.parse(req.body || {});
      const result = await arrearsBatchService.processBatch(req.context!, id, input);
      res.status(200).json(buildSuccessResponse(result, "Arrears batch processed into payroll adjustments successfully"));
    } catch (e) {
      next(e);
    }
  }
}
