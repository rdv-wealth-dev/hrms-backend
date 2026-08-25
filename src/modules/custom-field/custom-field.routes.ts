import { Router } from "express";
import { CustomFieldController } from "./custom-field.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { authorize } from "../../shared/middlewares/role.middleware";

const router = Router();
const controller = new CustomFieldController();

router.use(authenticate);

// List effective fields for an employee based on branch & department (Accessible to all authenticated users/employees)
router.get("/effective", controller.getEffective);

// List all custom field settings (Requires admin access)
router.get("/", authorize(["SUPER_ADMIN", "ORG_ADMIN", "HR_MANAGER"]), controller.list);

// Create custom field
router.post("/", authorize(["SUPER_ADMIN", "ORG_ADMIN", "HR_MANAGER"]), controller.create);

// Reorder custom fields sequence
router.post("/reorder", authorize(["SUPER_ADMIN", "ORG_ADMIN", "HR_MANAGER"]), controller.reorder);

// Update custom field
router.put("/:id", authorize(["SUPER_ADMIN", "ORG_ADMIN", "HR_MANAGER"]), controller.update);

// Delete custom field
router.delete("/:id", authorize(["SUPER_ADMIN", "ORG_ADMIN", "HR_MANAGER"]), controller.delete);

export default router;
