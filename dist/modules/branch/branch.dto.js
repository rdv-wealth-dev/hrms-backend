"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBranchDto = exports.CreateBranchDto = void 0;
const zod_1 = require("zod");
const common_validator_1 = require("../../core/validators/common.validator");
//Create Branch
exports.CreateBranchDto = zod_1.z.object({
    name: (0, common_validator_1.safeStringSchema)(2, 200),
    code: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .min(2, "Code must be at least 2 characters")
        .max(20, "Code must not exceed 20 characters"),
    parentBranchId: zod_1.z.string().optional(),
    address: zod_1.z.object({
        addressLine1: (0, common_validator_1.safeStringSchema)(1, 200).optional(),
        addressLine2: (0, common_validator_1.safeStringSchema)(1, 200).optional(),
        landmark: (0, common_validator_1.safeStringSchema)(1, 100).optional(),
        city: (0, common_validator_1.safeStringSchema)(1, 100).optional(),
        state: (0, common_validator_1.safeStringSchema)(1, 100).optional(),
        countryCode: common_validator_1.countryCodeSchema.optional(),
        zip: zod_1.z.string().trim().optional(),
    }).optional(),
    contact: zod_1.z.object({
        phone: zod_1.z.string().trim().optional(),
        email: zod_1.z.string().email().optional(),
    }).optional(),
    geo: zod_1.z.object({
        lat: zod_1.z.number().optional(),
        lng: zod_1.z.number().optional(),
        geofenceRadiusMeters: zod_1.z.number().min(50).max(5000).optional(),
        geofenceEnabled: zod_1.z.boolean().optional(),
    }).optional(),
    workPolicy: zod_1.z.object({
        timezone: zod_1.z.string().optional(),
        weeklyOffDays: zod_1.z.array(zod_1.z.string()).optional(),
        shiftStartTime: zod_1.z.string().optional(),
        shiftEndTime: zod_1.z.string().optional(),
        workingHoursPerDay: zod_1.z.number().min(1).max(24).optional(),
    }).optional(),
    statutory: zod_1.z.object({
        pfApplicable: zod_1.z.boolean().nullable().optional(),
        esiApplicable: zod_1.z.boolean().nullable().optional(),
        ptApplicable: zod_1.z.boolean().nullable().optional(),
        ptStateCode: zod_1.z.string().optional(),
    }).optional(),
});
//Update Branch
exports.UpdateBranchDto = exports.CreateBranchDto.partial();
//# sourceMappingURL=branch.dto.js.map