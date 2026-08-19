import { z } from "zod";
import { safeStringSchema, objectIdSchema } from "../../shared/validators/common.validator";
import { TeamType, TeamMemberRole, TeamReportingType } from "./team.model";

// CREATE TEAM DTO
export const CreateTeamDto = z.object({
  name: safeStringSchema(2, 150),
  code: safeStringSchema(2, 30).transform((val) => val.toUpperCase()),
  description: z.string().trim().optional(),
  type: z.nativeEnum(TeamType).default(TeamType.PERMANENT),
  branchId: objectIdSchema.optional(),
  departmentId: objectIdSchema, // Department is the mandatory top-level hierarchy
  isCrossFunctional: z.boolean().default(false),
  leadId: objectIdSchema.optional(),
  reporting: z.object({
    type: z.nativeEnum(TeamReportingType).default(TeamReportingType.DEPARTMENT_HEAD),
    targetId: objectIdSchema.optional(),
    targetName: z.string().trim().optional(),
  }).optional(),
  maxConcurrentLeaves: z.number().int().min(1).optional(),
  shiftId: objectIdSchema.optional(),
  tags: z.array(z.string().trim()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamDto>;

// UPDATE TEAM DTO
export const UpdateTeamDto = z.object({
  name: safeStringSchema(2, 150).optional(),
  description: z.string().trim().optional(),
  type: z.nativeEnum(TeamType).optional(),
  branchId: objectIdSchema.optional().nullable(),
  departmentId: objectIdSchema.optional().nullable(),
  isCrossFunctional: z.boolean().optional(),
  leadId: objectIdSchema.optional().nullable(),
  reporting: z.object({
    type: z.nativeEnum(TeamReportingType),
    targetId: objectIdSchema.optional().nullable(),
    targetName: z.string().trim().optional(),
  }).optional(),
  maxConcurrentLeaves: z.number().int().min(1).optional().nullable(),
  shiftId: objectIdSchema.optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateTeamInput = z.infer<typeof UpdateTeamDto>;

// ADD TEAM MEMBER DTO
export const AddTeamMemberDto = z.object({
  employeeId: objectIdSchema,
  roleInTeam: z.nativeEnum(TeamMemberRole).default(TeamMemberRole.MEMBER),
  isPrimary: z.boolean().default(true),
  allocationPercentage: z.number().int().min(1).max(100).default(100),
  joinedAt: z.string().datetime().optional(),
});

export type AddTeamMemberInput = z.infer<typeof AddTeamMemberDto>;

// UPDATE TEAM MEMBER DTO
export const UpdateTeamMemberDto = z.object({
  roleInTeam: z.nativeEnum(TeamMemberRole).optional(),
  isPrimary: z.boolean().optional(),
  allocationPercentage: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  leftAt: z.string().datetime().optional().nullable(),
});

export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberDto>;

// CHANGE TEAM LEAD DTO
export const ChangeTeamLeadDto = z.object({
  leadId: objectIdSchema,
});

export type ChangeTeamLeadInput = z.infer<typeof ChangeTeamLeadDto>;
