"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const organization_repository_1 = require("./organization.repository");
const app_error_1 = require("../../core/errors/app.error");
class OrganizationService {
    orgRepo = new organization_repository_1.OrganizationRepository();
    //Get my organization
    async getMyOrganization(context) {
        const org = await this.orgRepo.findById(context.tenantId);
        if (!org) {
            throw new app_error_1.AppError("Organization not found", 404);
        }
        return org;
    }
    //Update organization
    async updateOrganization(context, input) {
        const org = await this.orgRepo.findById(context.tenantId);
        if (!org) {
            throw new app_error_1.AppError("Organization not found", 404);
        }
        // Build update object — only update provided fields
        const updateData = {};
        if (input.companyName)
            updateData.companyName = input.companyName;
        if (input.legalName)
            updateData.legalName = input.legalName;
        if (input.industry)
            updateData.industry = input.industry;
        if (input.phone)
            updateData.phone = input.phone;
        if (input.gstin)
            updateData.gstin = input.gstin;
        if (input.pan)
            updateData.pan = input.pan;
        if (input.cin)
            updateData.cin = input.cin;
        if (input.tan)
            updateData.tan = input.tan;
        // Merge nested objects
        if (input.address) {
            updateData.address = {
                ...org.address,
                ...input.address,
            };
        }
        if (input.branding) {
            updateData.branding = {
                ...(org.branding ?? {}),
                ...input.branding,
            };
        }
        if (input.locale) {
            updateData.locale = {
                ...org.locale,
                ...input.locale,
            };
        }
        const updated = await this.orgRepo.updateById(context.tenantId, updateData);
        return updated;
    }
    // Update modules
    async updateModules(context, input) {
        const org = await this.orgRepo.findById(context.tenantId);
        if (!org) {
            throw new app_error_1.AppError("Organization not found", 404);
        }
        const updatedModules = {
            ...org.modules,
            ...input,
        };
        const updated = await this.orgRepo.updateById(context.tenantId, { modules: updatedModules });
        return updated;
    }
    // Update statutory
    async updateStatutory(context, input) {
        const org = await this.orgRepo.findById(context.tenantId);
        if (!org) {
            throw new app_error_1.AppError("Organization not found", 404);
        }
        const updatedStatutory = {
            ...org.statutory,
            ...input,
        };
        const updated = await this.orgRepo.updateById(context.tenantId, { statutory: updatedStatutory });
        return updated;
    }
}
exports.OrganizationService = OrganizationService;
//# sourceMappingURL=organization.service.js.map