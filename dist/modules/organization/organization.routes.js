"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organization_controller_1 = require("./organization.controller");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const validate_middleware_1 = require("../../core/validators/validate.middleware");
const organization_dto_1 = require("./organization.dto");
const router = (0, express_1.Router)();
const controller = new organization_controller_1.OrganizationController();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// GET /api/v1/organizations/me
router.get("/me", (0, rbac_middleware_1.checkPermission)("settings.read"), controller.getMe.bind(controller));
// PATCH /api/v1/organizations/me
router.patch("/me", (0, rbac_middleware_1.checkPermission)("settings.update"), (0, validate_middleware_1.validateBody)(organization_dto_1.UpdateOrganizationDto), controller.updateMe.bind(controller));
// PATCH /api/v1/organizations/me/modules
router.patch("/me/modules", (0, rbac_middleware_1.checkPermission)("settings.update"), (0, validate_middleware_1.validateBody)(organization_dto_1.UpdateModulesDto), controller.updateModules.bind(controller));
// PATCH /api/v1/organizations/me/statutory
router.patch("/me/statutory", (0, rbac_middleware_1.checkPermission)("settings.update"), (0, validate_middleware_1.validateBody)(organization_dto_1.UpdateStatutoryDto), controller.updateStatutory.bind(controller));
exports.default = router;
//# sourceMappingURL=organization.routes.js.map