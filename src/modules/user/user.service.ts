import mongoose from "mongoose";
import { UserModel } from "./user.model";
import { AssignRoleInput } from "./user.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class UserService {

    async assignRole(
        context: RequestContext,
        targetUserId: string,
        input: AssignRoleInput
    ) {
        const targetUser = await UserModel.findOne({
            _id: new mongoose.Types.ObjectId(targetUserId),
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            isDeleted: false,
        });
        if (!targetUser) {
            throw new AppError("User not found", 404);
        }

        // Never allow demoting/reassigning the org admin through this route
        if (targetUser.isOrgAdmin) {
            throw new AppError(
                "Cannot change role of an Org Admin account through this endpoint",
                403
            );
        }

        // Prevent a user from changing their own role (privilege escalation guard)
        if (targetUser._id.toString() === context.userId) {
            throw new AppError(
                "You cannot change your own role",
                403
            );
        }

        // Validate Role Hierarchy
        const ROLE_HIERARCHY: Record<string, number> = {
            "ORG_ADMIN": 100,
            "HR_ADMIN": 80,
            "BRANCH_ADMIN": 60,
            "LEADERSHIP": 50,
            "MANAGER": 40,
            "PRODUCT_MANAGER": 40,
            "TEAM_LEADER": 30,
            "EMPLOYEE": 10
        };

        const callerRoleWeight = ROLE_HIERARCHY[context.role] || 0;
        const targetUserCurrentRoleWeight = ROLE_HIERARCHY[targetUser.role] || 0;
        const newRoleWeight = ROLE_HIERARCHY[input.role] || 0;

        // 1. A caller cannot modify the role of someone with an equal or higher role weight
        if (targetUserCurrentRoleWeight >= callerRoleWeight) {
            throw new AppError(
                `You do not have permission to modify a user with a ${targetUser.role} role.`,
                403
            );
        }

        // 2. A caller cannot assign a role higher than their own role weight
        //    (equal is allowed — e.g., BRANCH_ADMIN can assign another BRANCH_ADMIN)
        if (newRoleWeight > callerRoleWeight) {
            throw new AppError(
                `You do not have permission to assign the ${input.role} role. You can only assign roles up to your own level.`,
                403
            );
        }

        targetUser.role = input.role;
        if (input.role === "BRANCH_ADMIN" && input.branchIds) {
            targetUser.branchIds = input.branchIds.map(
                (id) => new mongoose.Types.ObjectId(id)
            );
        } else {
            targetUser.branchIds = [];
        }

        await targetUser.save();
        return {
            id: targetUser._id,
            email: targetUser.email,
            role: targetUser.role,
            branchIds: targetUser.branchIds,
        };
    }

    async listUsers(context: RequestContext) {
        return UserModel.find({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            isDeleted: false,
        });
    }

    async getUserById(context: RequestContext, id: string) {
        const user = await UserModel.findOne({
            _id: new mongoose.Types.ObjectId(id),
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            isDeleted: false,
        });

        if (!user) throw new AppError("User not found", 404);
        return user;
    }
}