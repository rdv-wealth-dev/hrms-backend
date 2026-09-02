import { Request, Response, NextFunction } from "express";
import { BranchService } from "./branch.service";
import { buildSuccessResponse } from "../../shared/database/base.schema";

const branchService = new BranchService();

export class BranchController {

  // POST /api/v1/branches
  async create(
    req: Request,
    res: Response,
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
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await branchService.listBranches(req.context);
      res.status(200).json(
        buildSuccessResponse(result, `Branches fetched successfully count is ${result.length}`)
      );
    } catch (error) {
      next(error);
    }
  }



  // GET /api/v1/branches/head-office
  async getHeadOffice(
    req: Request,
    res: Response,
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
    req: Request<{ id: string }>,   // ← typed params
    res: Response,
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
    req: Request<{ id: string }>,   // ← typed params
    res: Response,
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
    req: Request<{ id: string }>,
    res: Response,
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

  // POST /api/v1/branches/:id/seed
  async seedBranchData(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await branchService.seedBranchData(
        req.context,
        id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Branch master data seeded successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/branches/:id/departments
  async deleteBranchDepartments(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const force = req.query.force === "true" || req.query.force === "1";
      const result = await branchService.deleteBranchDepartments(
        req.context,
        id,
        { force }
      );
      res.status(200).json(
        buildSuccessResponse(result, result.message || "Branch departments deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/branches/:id/designations
  async deleteBranchDesignations(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const force = req.query.force === "true" || req.query.force === "1";
      const result = await branchService.deleteBranchDesignations(
        req.context,
        id,
        { force }
      );
      res.status(200).json(
        buildSuccessResponse(result, result.message || "Branch designations deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}