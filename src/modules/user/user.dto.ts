import { z } from "zod";
import { objectIdSchema } from "../../core/validators/common.validator";

export const AssignRoleDto = z.object({
    role : z.enum([
        "HR_ADMIN",
        "BRANCH_ADMIN",
        "LEADERSHIP",
        "MANAGER",
        "PRODUCT_MANAGER",
        "EMPLOYEE",
        // SUPER_ADMIN deliberately excluded — promoting to super admin
    // should never happen through a simple API call; that's an
    // ownership-transfer action, not a role assignment
    ]),
    branchIds: z.array(objectIdSchema).optional(),

});

export type AssignRoleInput = z.infer<typeof AssignRoleDto>;
