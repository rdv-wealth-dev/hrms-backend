import { Router } from "express";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import {
  createRoleHandler,
  listRolesHandler,
  getRoleByIdHandler,
  updateRoleHandler,
  deleteRoleHandler,
  listAllPermissionsHandler,
} from "./role.controller";

const router = Router();

// List all system permissions for frontend role creation UI
router.get("/permissions", checkPermission("role.read"), listAllPermissionsHandler);

// Role CRUD
router.post("/", checkPermission("role.create"), createRoleHandler);
router.get("/", checkPermission("role.read"), listRolesHandler);
router.get("/:id", checkPermission("role.read"), getRoleByIdHandler);
router.put("/:id", checkPermission("role.update"), updateRoleHandler);
router.delete("/:id", checkPermission("role.update"), deleteRoleHandler);

export default router;