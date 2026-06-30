import { Request, Response, NextFunction } from "express";
import { DesignationService } from "./designation.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { paginationSchema } from "../../core/validators/common.validator";

const desgService = new DesignationService();

export class DesignationController {

  // POST /api/v1/designations
  async create(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await desgService.createDesignation(
        req.context,
        req.body
      );
      res.status(201).json(
        buildSuccessResponse(result, "Designation created successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/designations
  async list(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { pageNumber, pageSize } = paginationSchema.parse(req.query);
      const result = await desgService.listDesignations(
        req.context,
        { pageNumber, pageSize }
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/designations/:id
  async getById(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await desgService.getDesignationById(
        req.context,
        req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Designation fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/designations/:id
  async update(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await desgService.updateDesignation(
        req.context,
        req.params.id,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Designation updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/designations/:id
  async delete(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await desgService.deleteDesignation(
        req.context,
        req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Designation deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}