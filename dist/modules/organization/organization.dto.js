"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStatutoryDto = exports.UpdateModulesDto = exports.UpdateOrganizationDto = void 0;
const zod_1 = require("zod");
const common_validator_1 = require("../../core/validators/common.validator");
//Update Organization
exports.UpdateOrganizationDto = zod_1.z.object({
    companyName: (0, common_validator_1.safeStringSchema)(2, 200).optional(),
    legalName: (0, common_validator_1.safeStringSchema)(2, 300).optional(),
    industry: (0, common_validator_1.safeStringSchema)(2, 100).optional(),
    phone: zod_1.z.string().trim().optional(),
    gstin: common_validator_1.gstinSchema.optional(),
    pan: common_validator_1.panSchema.optional(),
    cin: zod_1.z.string().trim().uppercase().optional(),
    tan: zod_1.z.string().trim().uppercase().optional(),
    address: zod_1.z.object({
        addressLine1: (0, common_validator_1.safeStringSchema)(1, 200).optional(),
        addressLine2: (0, common_validator_1.safeStringSchema)(1, 200).optional(),
        city: (0, common_validator_1.safeStringSchema)(1, 100).optional(),
        state: (0, common_validator_1.safeStringSchema)(1, 100).optional(),
        countryCode: common_validator_1.countryCodeSchema.optional(),
        zip: zod_1.z.string().trim().optional(),
    }).optional(),
    branding: zod_1.z.object({
        logoUrl: common_validator_1.urlSchema,
        primaryColor: zod_1.z.string().trim().optional(),
        website: common_validator_1.urlSchema,
        supportEmail: zod_1.z.string().email().optional(),
        supportPhone: zod_1.z.string().trim().optional(),
    }).optional(),
    locale: zod_1.z.object({
        timezone: zod_1.z.string().trim().optional(),
        dateFormat: zod_1.z.string().trim().optional(),
        timeFormat: zod_1.z.enum(["12h", "24h"]).optional(),
        fiscalYearStart: zod_1.z.string().trim().optional(),
        weeklyOffDays: zod_1.z.array(zod_1.z.string()).optional(),
        workingHoursPerDay: zod_1.z.number().min(1).max(24).optional(),
    }).optional(),
});
//Update Modules
exports.UpdateModulesDto = zod_1.z.object({
    attendance: zod_1.z.boolean().optional(),
    leave: zod_1.z.boolean().optional(),
    payroll: zod_1.z.boolean().optional(),
    performance: zod_1.z.boolean().optional(),
    recruitment: zod_1.z.boolean().optional(),
    assets: zod_1.z.boolean().optional(),
});
// Update Statutory
exports.UpdateStatutoryDto = zod_1.z.object({
    pfEnabled: zod_1.z.boolean().optional(),
    esiEnabled: zod_1.z.boolean().optional(),
    tdsEnabled: zod_1.z.boolean().optional(),
    ptEnabled: zod_1.z.boolean().optional(),
    lwfEnabled: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=organization.dto.js.map