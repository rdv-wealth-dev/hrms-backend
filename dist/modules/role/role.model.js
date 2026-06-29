"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../../core/database/base.schema");
const RoleSchema = (0, base_schema_1.createOrgLevelSchema)({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        // NO index:true here — defined below in compound index
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
    },
    permissions: {
        type: [String],
        default: [],
    },
    isSystemRole: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});
// Compound indexes — tenantId always first
RoleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
RoleSchema.index({ tenantId: 1, isActive: 1 });
RoleSchema.index({ tenantId: 1, isSystemRole: 1 });
exports.RoleModel = mongoose_1.default.model("Role", RoleSchema);
//# sourceMappingURL=role.model.js.map