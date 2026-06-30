import { Request, Response, NextFunction } from "express";
import { DepartmentService } from "./department.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { paginationSchema } from "../../core/validators/common.validator";

const deptService = new DepartmentService();

export class DepartmentController {

  // POST /api/v1/departments
  async create(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await deptService.createDepartment(
        req.context,
        req.body
      );
      res.status(201).json(
        buildSuccessResponse(result, "Department created successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/departments
  async list(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { pageNumber, pageSize } = paginationSchema.parse(req.query);
      const result = await deptService.listDepartments(
        req.context,
        { pageNumber, pageSize }
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/departments/:id
  async getById(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await deptService.getDepartmentById(
        req.context,
        req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Department fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/departments/:id
  async update(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await deptService.updateDepartment(
        req.context,
        req.params.id,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Department updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/departments/:id
  async delete(
    req:  Request<{ id: string }>,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await deptService.deleteDepartment(
        req.context,
        req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Department deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}