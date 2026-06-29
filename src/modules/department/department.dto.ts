import { z } from "zod";
import { safeStringSchema, objectIdSchema, } from "../../core/validators/common.validator";

//Create Department
export const CreateDepartmentDto = z.object({
  name: safeStringSchema(2, 200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must not exceed 20 characters"),
  description: safeStringSchema(0, 500).optional().default(""),
  branchId:    objectIdSchema,
  parentId:    objectIdSchema.optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentDto>;

//Update Department
export const UpdateDepartmentDto = z.object({
  name:        safeStringSchema(2, 200).optional(),
  code:        z.string().trim().toUpperCase().min(2).max(20).optional(),
  description: safeStringSchema(0, 500).optional(),
  isActive:    z.boolean().optional(),
  parentId:    objectIdSchema.optional(),
});

export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentDto>;