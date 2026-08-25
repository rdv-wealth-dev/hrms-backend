import mongoose from "mongoose";
import { CustomFieldModel, CustomFieldDocument, CustomFieldScope } from "./custom-field.model";
import {
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  ReorderCustomFieldsInput,
  ListCustomFieldsQuery,
} from "./custom-field.dto";
import { RequestContext } from "../../shared/types/request-context.interface";
import { AppError } from "../../shared/errors/app.error";

function slugifyKey(label: string): string {
  return label
    .trim()
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

export class CustomFieldService {
  async createField(
    context: RequestContext,
    input: CreateCustomFieldInput
  ): Promise<CustomFieldDocument> {
    const fieldKey = input.fieldKey || slugifyKey(input.fieldLabel);

    // Check for duplicate key under the exact same scope
    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      fieldKey,
      scope: input.scope,
      isDeleted: false,
    };

    if (input.scope === CustomFieldScope.BRANCH && input.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(input.branchId);
    } else if (input.scope === CustomFieldScope.DEPARTMENT && input.departmentId) {
      filter.departmentId = new mongoose.Types.ObjectId(input.departmentId);
    }

    const existing = await CustomFieldModel.findOne(filter);
    if (existing) {
      throw new AppError(`A custom field with key '${fieldKey}' already exists for this scope`, 409);
    }

    // Auto-calculate next order sequence if not provided
    let order = input.order;
    if (order === 0) {
      const lastField = await CustomFieldModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      }).sort({ order: -1 });
      order = (lastField?.order ?? 0) + 1;
    }

    const field = new CustomFieldModel({
      ...input,
      fieldKey,
      order,
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      branchId: input.branchId ? new mongoose.Types.ObjectId(input.branchId) : null,
      departmentId: input.departmentId ? new mongoose.Types.ObjectId(input.departmentId) : null,
    });

    return field.save();
  }

  async listFields(
    context: RequestContext,
    query: ListCustomFieldsQuery
  ): Promise<CustomFieldDocument[]> {
    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    if (query.scope) filter.scope = query.scope;
    if (query.branchId) filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    if (query.departmentId) filter.departmentId = new mongoose.Types.ObjectId(query.departmentId);
    if (query.showInOnboarding !== undefined) filter.showInOnboarding = query.showInOnboarding;
    if (query.showInBulkImport !== undefined) filter.showInBulkImport = query.showInBulkImport;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    return CustomFieldModel.find(filter)
      .populate("branchId", "name")
      .populate("departmentId", "name")
      .sort({ order: 1, createdAt: 1 });
  }

  /**
   * Get all effective active custom fields applicable to an employee based on their Branch and Department.
   * Merges: Organization Scope + Specific Branch Scope + Specific Department Scope.
   */
  async getEffectiveFieldsForEmployee(
    tenantId: string,
    branchId?: string,
    departmentId?: string,
    options: { forOnboarding?: boolean; forBulkImport?: boolean; wizardStep?: number } = {}
  ): Promise<CustomFieldDocument[]> {
    const orConditions: Record<string, any>[] = [
      { scope: CustomFieldScope.ORGANIZATION },
    ];

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      orConditions.push({
        scope: CustomFieldScope.BRANCH,
        branchId: new mongoose.Types.ObjectId(branchId),
      });
    }

    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      orConditions.push({
        scope: CustomFieldScope.DEPARTMENT,
        departmentId: new mongoose.Types.ObjectId(departmentId),
      });
    }

    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
      isActive: true,
      $or: orConditions,
    };

    if (options.forOnboarding) {
      filter.showInOnboarding = true;
    }
    if (options.forBulkImport) {
      filter.showInBulkImport = true;
    }
    if (options.wizardStep !== undefined) {
      filter.wizardStep = options.wizardStep;
    }

    return CustomFieldModel.find(filter).sort({ order: 1, createdAt: 1 });
  }

  async updateField(
    context: RequestContext,
    id: string,
    input: UpdateCustomFieldInput
  ): Promise<CustomFieldDocument> {
    const field = await CustomFieldModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!field) {
      throw new AppError("Custom field not found", 404);
    }

    Object.assign(field, input);
    return field.save();
  }

  async deleteField(
    context: RequestContext,
    id: string,
    purgeValues: boolean = false
  ): Promise<void> {
    const field = await CustomFieldModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!field) {
      throw new AppError("Custom field not found", 404);
    }

    field.isDeleted = true;
    field.isActive = false;
    await field.save();

    // Optionally purge this custom field data from all existing employee documents
    if (purgeValues && field.fieldKey) {
      const { EmployeeModel } = require("../employee/models/employee.model");
      await EmployeeModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
        { $unset: { [`customFields.${field.fieldKey}`]: "" } }
      );
    }
  }

  async reorderFields(
    context: RequestContext,
    input: ReorderCustomFieldsInput
  ): Promise<void> {
    const bulkOps = input.items.map((item) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(item.id),
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
        },
        update: { $set: { order: item.order } },
      },
    }));

    await CustomFieldModel.bulkWrite(bulkOps);
  }
}
