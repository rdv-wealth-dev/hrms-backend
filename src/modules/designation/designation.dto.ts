import { z } from "zod";
import { safeStringSchema, objectIdSchema, } from "../../shared/validators/common.validator";


//Create Designation
export const CreateDesignationDto = z.object({
  name: safeStringSchema(2, 200).optional(),
  title: safeStringSchema(2, 200).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must not exceed 20 characters"),
  description:  safeStringSchema(0, 500).optional().default(""),
  departmentId: objectIdSchema,
  branchId: z.preprocess(
    (val) => (val === "" ? undefined : val),
    objectIdSchema.optional()
  ),
  level:        z.number().min(1).max(10).optional().default(1),
}).transform((data) => ({
  ...data,
  name: data.name || data.title || "",
})).refine((data) => data.name.length >= 2, {
  message: "Designation name (or title) must be at least 2 characters",
  path: ["name"],
});

export type CreateDesignationInput = z.infer<typeof CreateDesignationDto>;


//Update Designation
export const UpdateDesignationDto = z.object({
  name:        safeStringSchema(2, 200).optional(),
  code:        z.string().trim().toUpperCase().min(2).max(20).optional(),
  description: safeStringSchema(0, 500).optional(),
  level:       z.number().min(1).max(10).optional(),
  isActive:    z.boolean().optional(),
});

export type UpdateDesignationInput = z.infer<typeof UpdateDesignationDto>;