import { z } from "zod";
import { objectIdSchema } from "../../shared/validators/common.validator";

export const AssignRoleDto = z.object({
    role : z.enum([
        "HR_ADMIN",
        "BRANCH_ADMIN",
        "LEADERSHIP",
        "MANAGER",
        "TEAM_LEADER",
        "PRODUCT_MANAGER",
        "EMPLOYEE",
        // ORG_ADMIN deliberately excluded — promoting to org admin
        // should never happen through a simple API call; that's an
        // ownership-transfer action, not a role assignment
    ]),
    branchIds: z.array(objectIdSchema).optional(),
}).refine(
    (data) => {
        if (data.role === "BRANCH_ADMIN") {
            return data.branchIds && data.branchIds.length > 0;
        }
        return !data.branchIds || data.branchIds.length === 0;
    },
    {
        message: "branchIds is required and cannot be empty for BRANCH_ADMIN. For other roles, branchIds must be empty or omitted.",
        path: ["branchIds"]
    }
);

export type AssignRoleInput = z.infer<typeof AssignRoleDto>;
