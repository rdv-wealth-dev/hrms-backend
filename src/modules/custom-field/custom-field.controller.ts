import { Request, Response, NextFunction } from "express";
import { CustomFieldService } from "./custom-field.service";
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
  ReorderCustomFieldsDto,
  ListCustomFieldsQueryDto,
} from "./custom-field.dto";
import { buildSuccessResponse } from "../../shared/database/base.schema";

export class CustomFieldController {
  private service = new CustomFieldService();

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = CreateCustomFieldDto.parse(req.body);
      const result = await this.service.createField(req.context, validated);
      res.status(201).json(buildSuccessResponse(result, "Custom field created successfully"));
    } catch (e) {
      next(e);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ListCustomFieldsQueryDto.parse(req.query);
      const result = await this.service.listFields(req.context, query);
      res.status(200).json(buildSuccessResponse(result, "Custom fields retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  async getEffective(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
      const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
      const forOnboarding = req.query.forOnboarding === "true";
      const forBulkImport = req.query.forBulkImport === "true";

      const result = await this.service.getEffectiveFieldsForEmployee(
        req.context.tenantId,
        branchId,
        departmentId,
        { forOnboarding, forBulkImport }
      );
      res.status(200).json(buildSuccessResponse(result, "Effective custom fields retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = UpdateCustomFieldDto.parse(req.body);
      const id = req.params.id;
      const result = await this.service.updateField(req.context, id, validated);
      res.status(200).json(buildSuccessResponse(result, "Custom field updated successfully"));
    } catch (e) {
      next(e);
    }
  }

  async delete(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const purgeValues = req.query.purgeValues === "true";
      await this.service.deleteField(req.context, id, purgeValues);
      res.status(200).json(
        buildSuccessResponse(
          null,
          purgeValues
            ? "Custom field removed and data purged from all employee records"
            : "Custom field removed successfully"
        )
      );
    } catch (e) {
      next(e);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = ReorderCustomFieldsDto.parse(req.body);
      await this.service.reorderFields(req.context, validated);
      res.status(200).json(buildSuccessResponse(null, "Custom fields reordered successfully"));
    } catch (e) {
      next(e);
    }
  }
}
