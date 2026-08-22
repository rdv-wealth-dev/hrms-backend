import mongoose from "mongoose";
import { RoleModel } from "./role.model";
import { RoleRepository } from "./role.repository";
import { CreateRoleInput, UpdateRoleInput } from "./role.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { ALL_PERMISSIONS } from "../../database/seeds/permission.seed";
import { UserModel } from "../user/user.model";

export class RoleService {
  private roleRepo = new RoleRepository();

  // Create Custom Role
  async createRole(context: RequestContext, input: CreateRoleInput) {
    const slug = input.slug.toUpperCase();

    // Check if slug already exists in this tenant
    const existing = await RoleModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      slug,
      isDeleted: false,
    });

    if (existing) {
      throw new AppError(`Role with slug "${slug}" already exists in your organization`, 409);
    }

    // Validate that provided permissions exist in system
    const validResourceKeys = new Set(ALL_PERMISSIONS.map((p) => p.resource));
    const invalidPermissions = input.permissions.filter((p) => !validResourceKeys.has(p));
    if (invalidPermissions.length > 0) {
      throw new AppError(
        `Invalid permissions provided: ${invalidPermissions.join(", ")}`,
        400
      );
    }

    const role = await RoleModel.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      name: input.name,
      slug,
      description: input.description || "",
      permissions: input.permissions,
      isSystemRole: false,
      isActive: true,
      isDeleted: false,
    });

    return role;
  }

  private static readonly C_SUITE_ROLES = [
    "ORG_ADMIN",
    "SUPER_ADMIN",
    "CEO",
    "CTO",
    "CFO",
    "COO",
    "CHRO",
    "LEADERSHIP",
  ];

  // List all roles for tenant (System roles + Custom roles)
  async listRoles(context: RequestContext) {
    const isMasterAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(context.role);

    const query: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };

    // If not ORG_ADMIN / SUPER_ADMIN (e.g. HR_ADMIN), filter out C-Suite roles
    if (!isMasterAdmin) {
      query.slug = { $nin: RoleService.C_SUITE_ROLES };
    }

    const roles = await RoleModel.find(query).sort({ isSystemRole: -1, name: 1 });

    return roles;
  }

  // Get Role by ID
  async getRoleById(context: RequestContext, roleId: string) {
    const role = await RoleModel.findOne({
      _id: new mongoose.Types.ObjectId(roleId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    return role;
  }

  // Update Custom Role
  async updateRole(context: RequestContext, roleId: string, input: UpdateRoleInput) {
    const role = await RoleModel.findOne({
      _id: new mongoose.Types.ObjectId(roleId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    if (role.isSystemRole) {
      throw new AppError("System default roles cannot be modified", 403);
    }

    if (input.permissions) {
      const validResourceKeys = new Set(ALL_PERMISSIONS.map((p) => p.resource));
      const invalidPermissions = input.permissions.filter((p) => !validResourceKeys.has(p));
      if (invalidPermissions.length > 0) {
        throw new AppError(
          `Invalid permissions provided: ${invalidPermissions.join(", ")}`,
          400
        );
      }
      role.permissions = input.permissions;
    }

    if (input.name) role.name = input.name;
    if (input.description !== undefined) role.description = input.description;
    if (input.isActive !== undefined) role.isActive = input.isActive;

    await role.save();
    return role;
  }

  // Delete Custom Role
  async deleteRole(context: RequestContext, roleId: string) {
    const role = await RoleModel.findOne({
      _id: new mongoose.Types.ObjectId(roleId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    if (role.isSystemRole) {
      throw new AppError("System default roles cannot be deleted", 403);
    }

    // Check if any active user is assigned to this role
    const activeUsersWithRole = await UserModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      role: role.slug,
      isDeleted: false,
    });

    if (activeUsersWithRole > 0) {
      throw new AppError(
        `Cannot delete role "${role.name}" because it is currently assigned to ${activeUsersWithRole} user(s). Please reassign them first.`,
        400
      );
    }

    role.isDeleted = true;
    role.isActive = false;
    await role.save();

    return { message: `Role "${role.name}" deleted successfully` };
  }

  // Get all available system permissions grouped by module
  async getAllPermissions() {
    const grouped: Record<string, typeof ALL_PERMISSIONS> = {};

    for (const perm of ALL_PERMISSIONS) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    return {
      total: ALL_PERMISSIONS.length,
      permissions: ALL_PERMISSIONS,
      groupedByModule: grouped,
    };
  }
}
