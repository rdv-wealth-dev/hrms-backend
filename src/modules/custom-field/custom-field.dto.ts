import { z } from "zod";
import { objectIdSchema, safeStringSchema } from "../../shared/validators/index";

export const CustomFieldOptionSchema = z.union([
  z.string().trim().min(1),
  z.object({
    label: safeStringSchema(1, 100),
    value: safeStringSchema(1, 100),
    description: safeStringSchema(0, 200).optional(),
    color: safeStringSchema(0, 20).optional(),
  }),
]);

export const CreateCustomFieldDto = z.object({
  fieldLabel: safeStringSchema(2, 100),
  fieldKey: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9_]+$/, "Field key must contain only letters, numbers, and underscores")
    .optional(),
  fieldType: z.enum([
    "TEXT",
    "NUMBER",
    "DATE",
    "SELECT",
    "MULTI_SELECT",
    "BOOLEAN",
  ]).default("TEXT"),
  uiComponent: z.enum([
    "DROPDOWN",
    "RADIO_GROUP",
    "PILL_SELECT",
    "TEXT_INPUT",
    "SWITCH",
  ]).optional().default("DROPDOWN"),
  scope: z.enum(["ORGANIZATION", "BRANCH", "DEPARTMENT"]).default("ORGANIZATION"),
  branchId: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    objectIdSchema.optional()
  ),
  departmentId: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    objectIdSchema.optional()
  ),
  wizardStep: z.number().int().min(1).max(5).optional().default(1),
  section: safeStringSchema(0, 100).optional().default("PERSONAL_DETAILS"),
  options: z.array(CustomFieldOptionSchema).optional().default([]),
  placeholder: safeStringSchema(0, 200).optional(),
  helperText: safeStringSchema(0, 300).optional(),
  defaultValue: z.any().optional(),
  isRequired: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
  showInOnboarding: z.boolean().optional().default(true),
  showInBulkImport: z.boolean().optional().default(true),
}).refine(
  (data) => {
    if (data.scope === "BRANCH" && !data.branchId) {
      return false;
    }
    if (data.scope === "DEPARTMENT" && !data.departmentId) {
      return false;
    }
    return true;
  },
  {
    message: "Branch ID or Department ID is required when scope is BRANCH or DEPARTMENT",
    path: ["scope"],
  }
);

export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldDto>;

export const UpdateCustomFieldDto = z.object({
  fieldLabel: safeStringSchema(2, 100).optional(),
  fieldType: z.enum([
    "TEXT",
    "NUMBER",
    "DATE",
    "SELECT",
    "MULTI_SELECT",
    "BOOLEAN",
  ]).optional(),
  uiComponent: z.enum([
    "DROPDOWN",
    "RADIO_GROUP",
    "PILL_SELECT",
    "TEXT_INPUT",
    "SWITCH",
  ]).optional(),
  wizardStep: z.number().int().min(1).max(5).optional(),
  section: safeStringSchema(0, 100).optional(),
  options: z.array(CustomFieldOptionSchema).optional(),
  placeholder: safeStringSchema(0, 200).optional(),
  helperText: safeStringSchema(0, 300).optional(),
  defaultValue: z.any().optional(),
  isRequired: z.boolean().optional(),
  order: z.number().int().optional(),
  showInOnboarding: z.boolean().optional(),
  showInBulkImport: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCustomFieldInput = z.infer<typeof UpdateCustomFieldDto>;

export const ReorderCustomFieldsDto = z.object({
  items: z.array(
    z.object({
      id: objectIdSchema,
      order: z.number().int(),
    })
  ).min(1, "At least one item is required for reordering"),
});

export type ReorderCustomFieldsInput = z.infer<typeof ReorderCustomFieldsDto>;

export const ListCustomFieldsQueryDto = z.object({
  scope: z.enum(["ORGANIZATION", "BRANCH", "DEPARTMENT"]).optional(),
  branchId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  wizardStep: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(1).max(5).optional()),
  showInOnboarding: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  showInBulkImport: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type ListCustomFieldsQuery = z.infer<typeof ListCustomFieldsQueryDto>;
