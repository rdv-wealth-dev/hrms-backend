import { z } from "zod";
import { safeStringSchema } from "../../shared/validators/common.validator";

export const CreateRoleDto = z.object({
  name: safeStringSchema(2, 100),
  slug: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Role slug must be at least 2 characters")
    .max(50, "Role slug must not exceed 50 characters")
    .regex(/^[A-Z0-9_]+$/, "Role slug must contain only uppercase letters, numbers, and underscores"),
  description: z.string().trim().max(500).optional().default(""),
  permissions: z.array(z.string().trim()).min(1, "At least one permission is required"),
});

export type CreateRoleInput = z.infer<typeof CreateRoleDto>;

export const UpdateRoleDto = z.object({
  name: safeStringSchema(2, 100).optional(),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(z.string().trim()).min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleDto>;
