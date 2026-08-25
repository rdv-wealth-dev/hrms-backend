import { Request, Response } from "express";
import { CustomFieldService } from "./custom-field.service";
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
  ReorderCustomFieldsDto,
  ListCustomFieldsQueryDto,
} from "./custom-field.dto";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/utils/api-response.util";
import { RequestContext } from "../../shared/types/request-context.interface";

export class CustomFieldController {
  private service = new CustomFieldService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const validated = CreateCustomFieldDto.parse(req.body);
    const result = await this.service.createField(context, validated);
    return ApiResponse.created(res, result, "Custom field created successfully");
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const query = ListCustomFieldsQueryDto.parse(req.query);
    const result = await this.service.listFields(context, query);
    return ApiResponse.success(res, result, "Custom fields retrieved successfully");
  });

  getEffective = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
    const forOnboarding = req.query.forOnboarding === "true";
    const forBulkImport = req.query.forBulkImport === "true";

    const result = await this.service.getEffectiveFieldsForEmployee(
      context.tenantId,
      branchId,
      departmentId,
      { forOnboarding, forBulkImport }
    );
    return ApiResponse.success(res, result, "Effective custom fields retrieved successfully");
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const validated = UpdateCustomFieldDto.parse(req.body);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await this.service.updateField(context, id, validated);
    return ApiResponse.success(res, result, "Custom field updated successfully");
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const purgeValues = req.query.purgeValues === "true";
    await this.service.deleteField(context, id, purgeValues);
    return ApiResponse.success(
      res,
      null,
      purgeValues
        ? "Custom field removed and data purged from all employee records"
        : "Custom field removed successfully"
    );
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const context = req.context as RequestContext;
    const validated = ReorderCustomFieldsDto.parse(req.body);
    await this.service.reorderFields(context, validated);
    return ApiResponse.success(res, null, "Custom fields reordered successfully");
  });
}
