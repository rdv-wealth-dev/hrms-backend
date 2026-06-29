"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchController = void 0;
const branch_service_1 = require("./branch.service");
const base_schema_1 = require("../../core/database/base.schema");
const branchService = new branch_service_1.BranchService();
class BranchController {
    // POST /api/v1/branches
    async create(req, res, next) {
        try {
            const result = await branchService.createBranch(req.context, req.body);
            res.status(201).json((0, base_schema_1.buildSuccessResponse)(result, "Branch created successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/v1/branches
    async list(req, res, next) {
        try {
            const result = await branchService.listBranches(req.context);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Branches fetched successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/v1/branches/head-office
    async getHeadOffice(req, res, next) {
        try {
            const result = await branchService.getHeadOffice(req.context);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Head office fetched successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // GET /api/v1/branches/:id
    async getById(req, // ← typed params
    res, next) {
        try {
            const { id } = req.params;
            const result = await branchService.getBranchById(req.context, id);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Branch fetched successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // PATCH /api/v1/branches/:id
    async update(req, // ← typed params
    res, next) {
        try {
            const { id } = req.params;
            const result = await branchService.updateBranch(req.context, id, req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Branch updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // DELETE /api/v1/branches/:id
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const result = await branchService.deleteBranch(req.context, id);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Branch deleted successfully"));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BranchController = BranchController;
//# sourceMappingURL=branch.controller.js.map