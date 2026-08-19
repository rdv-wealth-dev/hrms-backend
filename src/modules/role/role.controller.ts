import { Request, Response, NextFunction } from "express";
import { RoleService } from "./role.service";
import { CreateRoleDto, UpdateRoleDto } from "./role.dto";

const roleService = new RoleService();

export async function createRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateRoleDto.parse(req.body);
    const role = await roleService.createRole(req.context, input);
    res.status(201).json({
      success: true,
      message: "Custom role created successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
}

export async function listRolesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await roleService.listRoles(req.context);
    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoleByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = String(req.params.id);
    const role = await roleService.getRoleById(req.context, roleId);
    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = String(req.params.id);
    const input = UpdateRoleDto.parse(req.body);
    const role = await roleService.updateRole(req.context, roleId, input);
    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roleId = String(req.params.id);
    const result = await roleService.deleteRole(req.context, roleId);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAllPermissionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await roleService.getAllPermissions();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
