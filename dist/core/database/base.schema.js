"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseSchemaOptions = exports.baseSchemaFieldsNoBranch = exports.baseSchemaFields = void 0;
exports.createBaseSchema = createBaseSchema;
exports.createOrgLevelSchema = createOrgLevelSchema;
exports.createPlatformSchema = createPlatformSchema;
exports.buildPagedResponse = buildPagedResponse;
exports.buildSuccessResponse = buildSuccessResponse;
exports.buildErrorResponse = buildErrorResponse;
const mongoose_1 = __importStar(require("mongoose"));
// BASE SCHEMA FIELDS
exports.baseSchemaFields = {
    tenantId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        // ref removed — no population needed at base level
        // prevents ref validation issues during seeding
        required: true,
        index: true,
    },
    branchId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
    },
    updatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true,
    },
    version: {
        type: Number,
        default: 1,
    },
};
// For org-level collections — no branchId
exports.baseSchemaFieldsNoBranch = {
    tenantId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        // ref removed — prevents Mongoose ref validation
        // during seeding when org may not be committed yet
        required: true,
        index: true,
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
    },
    updatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true,
    },
    version: {
        type: Number,
        default: 1,
    },
};
// BASE SCHEMA OPTIONS
exports.baseSchemaOptions = {
    timestamps: true,
    versionKey: "__v",
};
// HOOKS — applied to every schema
function applyBaseHooks(schema) {
    // Auto-increment version on every update
    schema.pre("save", function (next) {
        if (!this.isNew) {
            this.version = this.version + 1;
        }
        next();
    });
    // Auto-filter soft deleted docs on every find
    schema.pre(/^find/, function (next) {
        const query = this;
        const conditions = query.getFilter();
        if (conditions.isDeleted === undefined) {
            query.where({ isDeleted: false });
        }
        next();
    });
}
// SCHEMA FACTORIES
// For branch-level collections
// employees · attendance · leave · payroll · departments · designations
function createBaseSchema(fields, options = {}) {
    const schema = new mongoose_1.Schema({ ...exports.baseSchemaFields, ...fields }, { ...exports.baseSchemaOptions, ...options });
    applyBaseHooks(schema);
    return schema;
}
// For org-level collections — no branchId
// organizations · roles · users · audit_logs · leave_types · salary_components
function createOrgLevelSchema(fields, options = {}) {
    const schema = new mongoose_1.Schema({ ...exports.baseSchemaFieldsNoBranch, ...fields }, { ...exports.baseSchemaOptions, ...options });
    applyBaseHooks(schema);
    return schema;
}
// For platform-level collections — no tenantId, no branchId
// permissions · subscription_plans
function createPlatformSchema(fields, options = {}) {
    const schema = new mongoose_1.Schema({
        ...fields,
        isDeleted: { type: Boolean, default: false, index: true },
        version: { type: Number, default: 1 },
    }, { ...exports.baseSchemaOptions, ...options });
    applyBaseHooks(schema);
    return schema;
}
// RESPONSE BUILDERS
function buildPagedResponse({ data, pageNumber, pageSize, totalRecords, baseUrl = "", message = null, }) {
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const buildUrl = (page) => baseUrl
        ? `${baseUrl}?pageNumber=${page}&pageSize=${pageSize}`
        : null;
    return {
        succeeded: true,
        message,
        errors: [],
        data,
        pageNumber,
        pageSize,
        totalPages,
        totalRecords,
        firstPage: buildUrl(1),
        lastPage: buildUrl(totalPages),
        nextPage: pageNumber < totalPages ? buildUrl(pageNumber + 1) : null,
        previousPage: pageNumber > 1 ? buildUrl(pageNumber - 1) : null,
    };
}
function buildSuccessResponse(data, message = "Success") {
    return { succeeded: true, message, errors: [], data };
}
function buildErrorResponse(message, errors = []) {
    return { succeeded: false, message, errors, data: null };
}
//# sourceMappingURL=base.schema.js.map