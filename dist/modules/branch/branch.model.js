"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../../core/database/base.schema");
// BRANCH SCHEMA
// Uses createBaseSchema — inherits tenantId + branchId + base fields
// branchId overridden to optional — branch does not reference itself
// parentBranchId handles branch hierarchy separately
const BranchSchema = (0, base_schema_1.createBaseSchema)({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 20,
    },
    isHeadOffice: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    parentBranchId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Branch",
        default: null,
    },
    address: {
        addressLine1: { type: String, trim: true },
        addressLine2: { type: String, trim: true },
        landmark: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        countryCode: { type: String, trim: true, uppercase: true },
        zip: { type: String, trim: true },
    },
    contact: {
        phone: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
    },
    geo: {
        lat: { type: Number },
        lng: { type: Number },
        geofenceRadiusMeters: { type: Number, default: 200 },
        geofenceEnabled: { type: Boolean, default: false },
    },
    workPolicy: {
        timezone: { type: String },
        weeklyOffDays: { type: [String] },
        shiftStartTime: { type: String },
        shiftEndTime: { type: String },
        workingHoursPerDay: { type: Number },
    },
    statutory: {
        pfApplicable: { type: Boolean, default: null },
        esiApplicable: { type: Boolean, default: null },
        ptApplicable: { type: Boolean, default: null },
        ptStateCode: { type: String, trim: true },
    },
}, {
    collection: "branches",
});
// OVERRIDE — branchId not required on Branch collection
// Branch IS a branch — branchId self-reference not needed
// parentBranchId handles hierarchy
BranchSchema.path("branchId").required(false);
// INDEXES
// tenantId always first in every compound index
BranchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
BranchSchema.index({ tenantId: 1, isHeadOffice: 1 });
BranchSchema.index({ tenantId: 1, isActive: 1 });
BranchSchema.index({ tenantId: 1, isDeleted: 1 });
// STATICS
BranchSchema.statics.getHeadOffice = function (tenantId) {
    return this.findOne({
        tenantId,
        isHeadOffice: true,
        isDeleted: false,
    });
};
// EXPORT
exports.BranchModel = mongoose_1.default.model("Branch", BranchSchema);
//# sourceMappingURL=branch.model.js.map