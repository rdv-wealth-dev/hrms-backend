"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDepartmentDto = exports.CreateDepartmentDto = void 0;
const zod_1 = require("zod");
const common_validator_1 = require("../../core/validators/common.validator");
//Create Department
exports.CreateDepartmentDto = zod_1.z.object({
    name: (0, common_validator_1.safeStringSchema)(2, 200),
    code: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .min(2, "Code must be at least 2 characters")
        .max(20, "Code must not exceed 20 characters"),
    description: (0, common_validator_1.safeStringSchema)(0, 500).optional().default(""),
    branchId: common_validator_1.objectIdSchema,
    parentId: common_validator_1.objectIdSchema.optional(),
});
//Update Department
exports.UpdateDepartmentDto = zod_1.z.object({
    name: (0, common_validator_1.safeStringSchema)(2, 200).optional(),
    code: zod_1.z.string().trim().toUpperCase().min(2).max(20).optional(),
    description: (0, common_validator_1.safeStringSchema)(0, 500).optional(),
    isActive: zod_1.z.boolean().optional(),
    parentId: common_validator_1.objectIdSchema.optional(),
});
//# sourceMappingURL=department.dto.js.map