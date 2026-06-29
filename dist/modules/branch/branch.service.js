"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const branch_repository_1 = require("./branch.repository");
const app_error_1 = require("../../core/errors/app.error");
const organization_repository_1 = require("../organization/organization.repository");
class BranchService {
    branchRepo = new branch_repository_1.BranchRepository();
    orgRepo = new organization_repository_1.OrganizationRepository();
    //Create branch
    async createBranch(context, input) {
        // Check subscription branch limit
        const org = await this.orgRepo.findById(context.tenantId);
        if (!org)
            throw new app_error_1.AppError("Organization not found", 404);
        const existingBranches = await this.branchRepo.findAllByTenant(context.tenantId);
        if (existingBranches.length >= org.subscription.maxBranches) {
            throw new app_error_1.AppError(`Branch limit reached. Your plan allows ${org.subscription.maxBranches} branch(es). Please upgrade.`, 403);
        }
        // Check code uniqueness within tenant
        const codeExists = await this.branchRepo.codeExists(context.tenantId, input.code);
        if (codeExists) {
            throw new app_error_1.AppError(`Branch code "${input.code}" already exists`, 409);
        }
        const branch = await this.branchRepo.create({
            tenantId: new mongoose_1.default.Types.ObjectId(context.tenantId),
            name: input.name,
            code: input.code,
            isHeadOffice: false,
            isActive: true,
            parentBranchId: input.parentBranchId
                ? new mongoose_1.default.Types.ObjectId(input.parentBranchId)
                : undefined,
            address: input.address,
            contact: input.contact,
            geo: input.geo,
            workPolicy: input.workPolicy,
            statutory: input.statutory,
        });
        return branch;
    }
    // List all branches
    async listBranches(context) {
        const branches = await this.branchRepo.findAllByTenant(context.tenantId);
        return branches;
    }
    //Get branch by ID
    async getBranchById(context, id) {
        const branch = await this.branchRepo.findById(id);
        if (!branch) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        // Verify branch belongs to this tenant
        if (branch.tenantId.toString() !== context.tenantId) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        return branch;
    }
    //Get head office
    async getHeadOffice(context) {
        const branch = await this.branchRepo.findHeadOffice(context.tenantId);
        if (!branch) {
            throw new app_error_1.AppError("Head office not found", 404);
        }
        return branch;
    }
    //Update branch
    async updateBranch(context, id, input) {
        const branch = await this.branchRepo.findById(id);
        if (!branch) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        if (branch.tenantId.toString() !== context.tenantId) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        // Prevent changing code if already in use by another branch
        if (input.code && input.code !== branch.code) {
            const codeExists = await this.branchRepo.codeExists(context.tenantId, input.code);
            if (codeExists) {
                throw new app_error_1.AppError(`Branch code "${input.code}" already exists`, 409);
            }
        }
        const updateData = {};
        if (input.name)
            updateData.name = input.name;
        if (input.code)
            updateData.code = input.code;
        if (input.address)
            updateData.address = { ...branch.address, ...input.address };
        if (input.contact)
            updateData.contact = { ...branch.contact, ...input.contact };
        if (input.geo)
            updateData.geo = { ...branch.geo, ...input.geo };
        if (input.workPolicy)
            updateData.workPolicy = { ...branch.workPolicy, ...input.workPolicy };
        if (input.statutory)
            updateData.statutory = { ...branch.statutory, ...input.statutory };
        const updated = await this.branchRepo.updateById(id, updateData);
        return updated;
    }
    //Delete branch
    async deleteBranch(context, id) {
        const branch = await this.branchRepo.findById(id);
        if (!branch) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        if (branch.tenantId.toString() !== context.tenantId) {
            throw new app_error_1.AppError("Branch not found", 404);
        }
        // Cannot delete head office
        if (branch.isHeadOffice) {
            throw new app_error_1.AppError("Cannot delete Head Office branch", 400);
        }
        await this.branchRepo.softDeleteById(id);
        return { message: "Branch deleted successfully" };
    }
}
exports.BranchService = BranchService;
//# sourceMappingURL=branch.service.js.map