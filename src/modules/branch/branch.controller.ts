import { Request, Response, NextFunction } from "express";
import { BranchService }                   from "./branch.service";
import { buildSuccessResponse }            from "../../core/database/base.schema";

const branchService = new BranchService();

export class BranchController {

  // POST /api/v1/branches
  async create(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await branchService.createBranch(
        req.context,
        req.body
      );
      res.status(201).json(
        buildSuccessResponse(result, "Branch created successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/branches
  async list(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await branchService.listBranches(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Branches fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/branches/head-office
  async getHeadOffice(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await branchService.getHeadOffice(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Head office fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/branches/:id
  async getById(
    req:  Request<{ id: string }>,   // ← typed params
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await branchService.getBranchById(
        req.context,
        id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Branch fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/branches/:id
  async update(
    req:  Request<{ id: string }>,   // ← typed params
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await branchService.updateBranch(
        req.context,
        id,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Branch updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/branches/:id
  async delete(
    req:  Request<{ id: string }>,  
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await branchService.deleteBranch(
        req.context,
        id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Branch deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}