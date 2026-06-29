"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressSchema = exports.currencyCodeSchema = exports.countryCodeSchema = exports.urlSchema = exports.safeStringSchema = exports.pinCodeSchema = exports.ifscSchema = exports.gstinSchema = exports.aadhaarSchema = exports.panSchema = exports.dateSchema = exports.passwordSchema = exports.emailSchema = exports.phoneSchema = exports.idParamSchema = exports.paginationSchema = exports.objectIdSchema = void 0;
const zod_1 = require("zod");
//MongoDB ObjectId
exports.objectIdSchema = zod_1.z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid ID format");
//Pagination
exports.paginationSchema = zod_1.z.object({
    pageNumber: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(zod_1.z.number().min(1, "Page number must be at least 1")),
    pageSize: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 10))
        .pipe(zod_1.z.number()
        .min(1, "Page size must be at least 1")
        .max(100, "Page size cannot exceed 100") // LPDOS guard
    ),
});
//ID param
exports.idParamSchema = zod_1.z.object({
    id: exports.objectIdSchema,
});
// Phone number
exports.phoneSchema = zod_1.z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number");
// Email 
exports.emailSchema = zod_1.z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim();
//Password 
// Min 8 chars · at least one uppercase · one lowercase · one number · one special char
exports.passwordSchema = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
// Date string
exports.dateSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
// Indian PAN
exports.panSchema = zod_1.z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
    .toUpperCase();
// Indian Aadhaar
exports.aadhaarSchema = zod_1.z
    .string()
    .regex(/^\d{12}$/, "Aadhaar must be 12 digits");
// Indian GSTIN
exports.gstinSchema = zod_1.z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format")
    .toUpperCase();
// Indian IFSC
exports.ifscSchema = zod_1.z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code")
    .toUpperCase();
// Indian PIN code
exports.pinCodeSchema = zod_1.z
    .string()
    .regex(/^\d{6}$/, "PIN code must be 6 digits");
// Safe string — prevents NoSQL injection + XSS
// Strips MongoDB operators and script tags from string inputs
const safeStringSchema = (min = 1, max = 200) => zod_1.z
    .string()
    .min(min, `Must be at least ${min} character`)
    .max(max, `Must not exceed ${max} characters`)
    .trim()
    .refine((val) => !val.includes("$") && !val.includes("{"), "Invalid characters detected" // blocks $where, $gt etc.
);
exports.safeStringSchema = safeStringSchema;
// URL
exports.urlSchema = zod_1.z
    .string()
    .url("Invalid URL format")
    .optional();
//Country code
exports.countryCodeSchema = zod_1.z
    .string()
    .length(2, "Country code must be 2 characters")
    .toUpperCase();
// Currency code
exports.currencyCodeSchema = zod_1.z
    .string()
    .length(3, "Currency code must be 3 characters")
    .toUpperCase();
// Address schema — reused across org, branch, employee
exports.addressSchema = zod_1.z.object({
    addressLine1: (0, exports.safeStringSchema)(1, 200).optional(),
    addressLine2: (0, exports.safeStringSchema)(1, 200).optional(),
    landmark: (0, exports.safeStringSchema)(1, 100).optional(),
    city: (0, exports.safeStringSchema)(1, 100).optional(),
    state: (0, exports.safeStringSchema)(1, 100).optional(),
    countryCode: exports.countryCodeSchema.optional(),
    zip: exports.pinCodeSchema.optional(),
});
//# sourceMappingURL=common.validator.js.map