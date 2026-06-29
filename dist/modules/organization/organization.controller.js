"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const organization_service_1 = require("./organization.service");
const base_schema_1 = require("../../core/database/base.schema");
const orgService = new organization_service_1.OrganizationService();
class OrganizationController {
    // GET /api/v1/organizations/me
    async getMe(req, res, next) {
        try {
            const result = await orgService.getMyOrganization(req.context);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Organization fetched successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/v1/organizations/me
    async updateMe(req, res, next) {
        try {
            const result = await orgService.updateOrganization(req.context, req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Organization updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/v1/organizations/me/modules
    async updateModules(req, res, next) {
        try {
            const result = await orgService.updateModules(req.context, req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Modules updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/v1/organizations/me/statutory
    async updateStatutory(req, res, next) {
        try {
            const result = await orgService.updateStatutory(req.context, req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Statutory settings updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.OrganizationController = OrganizationController;
//# sourceMappingURL=organization.controller.js.map