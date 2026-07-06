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
            _id : new mongoose.Types.ObjectId(targetUserId),
            tenantId : new mongoose.Types.ObjectId(context.tenantId),
            isDeleted : false,
        });
        if(!targetUser){
            throw new AppError("User not found", 404);
        }

        // Never allow demoting/reassigning the super admin through this route
        if (targetUser.isSuperAdmin){
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

        targetUser.role = input.role;
        if (input.branchIds){
            targetUser.branchIds = input.branchIds.map(
                (id) => new mongoose.Types.ObjectId(id)
            );
        }

        await targetUser.save();
        return {
            id:        targetUser._id,
            email:     targetUser.email,
            role:      targetUser.role,
            branchIds: targetUser.branchIds,
        };
    }

    async listUsers(context: RequestContext) {
        return UserModel.find({
            tenantId :new mongoose.Types.ObjectId(context.tenantId),
            isDeleted : false,
        }).select("-passwordHash");
    }

    async getUserById(context: RequestContext, id: string) {
    const user = await UserModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("-passwordHash -accountActivationToken -resetPasswordToken -emailVerificationToken");

    if (!user) throw new AppError("User not found", 404);
    return user;
  }
}