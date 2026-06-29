"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.globalErrorHandler = void 0;
const app_error_1 = require("./app.error");
const logger_1 = require("../../config/logger");
const base_schema_1 = require("../database/base.schema");
// Global Error Handler
const globalErrorHandler = (err, req, res, _next) => {
    logger_1.logger.error({
        message: err.message,
        stack: err.stack,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        tenantId: req.context?.tenantId ?? "unauthenticated",
    });
    if (err instanceof app_error_1.AppError) {
        res.status(err.statusCode).json((0, base_schema_1.buildErrorResponse)(err.message, err.errors));
        return;
    }
    // MongoDB duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue ?? {})[0];
        res.status(409).json((0, base_schema_1.buildErrorResponse)(`${field} already exists`));
        return;
    }
    // Mongoose validation error
    if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((e) => e.message);
        res.status(400).json((0, base_schema_1.buildErrorResponse)("Validation failed", errors));
        return;
    }
    // JWT errors
    if (err.name === "JsonWebTokenError") {
        res.status(401).json((0, base_schema_1.buildErrorResponse)("Invalid token"));
        return;
    }
    if (err.name === "TokenExpiredError") {
        res.status(401).json((0, base_schema_1.buildErrorResponse)("Token expired"));
        return;
    }
    // Unknown — never leak details in production
    res.status(500).json((0, base_schema_1.buildErrorResponse)(process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message));
};
exports.globalErrorHandler = globalErrorHandler;
// Async handler wrapper
// Wraps async controllers — no try/catch needed in any controller
// Usage: router.get("/", asyncHandler(controller.list))
const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=error.middleware.js.map