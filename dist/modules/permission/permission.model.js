"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../../core/database/base.schema");
const PermissionSchema = (0, base_schema_1.createPlatformSchema)({
    module: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    resource: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        // NO unique:true here — defined below
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});
// Single indexes — no duplicates
PermissionSchema.index({ module: 1 });
PermissionSchema.index({ resource: 1 }, { unique: true });
exports.PermissionModel = mongoose_1.default.model("Permission", PermissionSchema);
//# sourceMappingURL=permission.model.js.map