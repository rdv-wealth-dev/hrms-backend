import { Request, Response, NextFunction } from "express";
import { RegularizationService } from "./regularization.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const regService = new RegularizationService();

export class RegularizationController {

  // POST /api/v1/attendance/regularizations
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await regService.createRequest(req.context, req.body);
      res.status(201).json(buildSuccessResponse(result, "Regularization request submitted"));
    } catch (error) { next(error); }
  }

  // GET /api/v1/attendance/regularizations/me
  async getMyRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await regService.getMyRequests(req.context);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  // GET /api/v1/attendance/regularizations/pending
  async getPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await regService.getPendingRequests(req.context);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  // PATCH /api/v1/attendance/regularizations/:id/review
  async review(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await regService.review(req.context, req.params.id, req.body);
      res.status(200).json(buildSuccessResponse(result, "Regularization reviewed"));
    } catch (error) { next(error); }
  }
}
