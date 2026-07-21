import { Request, Response, NextFunction } from "express";
import { ShiftRotationPlanService } from "./shift-rotation-plan.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

export class ShiftRotationPlanController {
  private service = new ShiftRotationPlanService();

  // POST /api/v1/attendance/rotation-plans
  async create(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.createPlan(req.context, req.body);
      res.status(201).json(buildSuccessResponse(result, "Rotation plan created"));
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/attendance/rotation-plans
  async list(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.listPlans(req.context);
      res.status(200).json(buildSuccessResponse(result, "Rotation plans fetched"));
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/attendance/rotation-plans/:id
  async getById(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.getPlanById(req.context, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Rotation plan fetched"));
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/v1/attendance/rotation-plans/:id
  async update(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.updatePlan(req.context, req.params.id, req.body);
      res.status(200).json(buildSuccessResponse(result, "Rotation plan updated"));
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/v1/attendance/rotation-plans/:id
  async delete(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.deletePlan(req.context, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Rotation plan deleted"));
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/attendance/rotation-plans/assign
  async assign(req: any, res: Response, next: NextFunction) {
    try {
      const result = await this.service.assignPlan(req.context, req.body);
      res.status(200).json(buildSuccessResponse(result, "Rotation plan assignment updated"));
    } catch (err) {
      next(err);
    }
  }
}
