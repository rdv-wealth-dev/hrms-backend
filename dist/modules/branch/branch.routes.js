"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("./branch.controller");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const validate_middleware_1 = require("../../core/validators/validate.middleware");
const branch_dto_1 = require("./branch.dto");
const router = (0, express_1.Router)();
const controller = new branch_controller_1.BranchController();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// GET /api/v1/branches/head-office
// Must be before /:id to avoid conflict
router.get("/head-office", (0, rbac_middleware_1.checkPermission)("branch.read"), controller.getHeadOffice.bind(controller));
// GET /api/v1/branches
router.get("/", (0, rbac_middleware_1.checkPermission)("branch.read"), controller.list.bind(controller));
// POST /api/v1/branches
router.post("/", (0, rbac_middleware_1.checkPermission)("branch.create"), (0, validate_middleware_1.validateBody)(branch_dto_1.CreateBranchDto), controller.create.bind(controller));
// GET /api/v1/branches/:id
router.get("/:id", (0, rbac_middleware_1.checkPermission)("branch.read"), controller.getById.bind(controller));
// PATCH /api/v1/branches/:id
router.patch("/:id", (0, rbac_middleware_1.checkPermission)("branch.update"), (0, validate_middleware_1.validateBody)(branch_dto_1.UpdateBranchDto), controller.update.bind(controller));
// DELETE /api/v1/branches/:id
router.delete("/:id", (0, rbac_middleware_1.checkPermission)("branch.update"), controller.delete.bind(controller));
exports.default = router;
//# sourceMappingURL=branch.routes.js.map