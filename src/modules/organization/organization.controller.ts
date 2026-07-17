import { Request, Response, NextFunction } from "express";
import { OrganizationService } from "./organization.service";
import { UpdateMandatoryDocsInput } from "./organization.dto";
import { buildSuccessResponse } from "../../core/database/base.schema";

const orgService = new OrganizationService();

export class OrganizationController {

  // GET /api/v1/organizations/me
  async getMe(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await orgService.getMyOrganization(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Organization fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/organizations/me
  async updateMe(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await orgService.updateOrganization(
        req.context,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Organization updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/organizations/me/modules
  async updateModules(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await orgService.updateModules(
        req.context,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Modules updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/organizations/me/statutory
  async updateStatutory(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await orgService.updateStatutory(
        req.context,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Statutory settings updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/organizations/me/mandatory-docs
  async updateMandatoryDocs(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await orgService.updateMandatoryDocs(
        req.context,
        req.body as UpdateMandatoryDocsInput
      );
      res.status(200).json(
        buildSuccessResponse(result, "Mandatory document types updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}