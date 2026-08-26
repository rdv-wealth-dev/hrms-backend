import { Router } from "express";
import { CustomFieldController } from "./custom-field.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkRole } from "../../shared/middlewares/rbac.middleware";

const router = Router();
const controller = new CustomFieldController();

router.use(authenticate);

// List effective fields for an employee based on branch & department (Accessible to all authenticated users/employees)
router.get("/effective", controller.getEffective.bind(controller));

// List all custom field settings (Requires admin access)
router.get("/", checkRole("SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"), controller.list.bind(controller));

// Create custom field
router.post("/", checkRole("SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"), controller.create.bind(controller));

// Reorder custom fields sequence
router.post("/reorder", checkRole("SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"), controller.reorder.bind(controller));

// Update custom field
router.put("/:id", checkRole("SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"), controller.update.bind(controller));

// Delete custom field
router.delete("/:id", checkRole("SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "HR_MANAGER"), controller.delete.bind(controller));

export default router;
