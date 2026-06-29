"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../../core/database/base.schema");
// DEPARTMENT SCHEMA
// Uses createBaseSchema — departments belong to a branch
const DepartmentSchema = (0, base_schema_1.createBaseSchema)({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    code: {
        // Short identifier — "ENG", "HR", "FIN"
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 20,
    },
    description: {
        type: String,
        trim: true,
        default: "",
    },
    headId: {
        // Employee who heads this department
        // Optional — set after employees are created
        type: mongoose_1.default.Schema.Types.ObjectId,
        default: null,
    },
    parentId: {
        // Parent department for nested structure
        // e.g. Frontend under Engineering
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Department",
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { collection: "departments" });
//Indexes
DepartmentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ tenantId: 1, branchId: 1 });
DepartmentSchema.index({ tenantId: 1, isActive: 1 });
exports.DepartmentModel = mongoose_1.default.model("Department", DepartmentSchema);
//# sourceMappingURL=department.model.js.map