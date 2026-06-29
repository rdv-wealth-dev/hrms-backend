"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.BadRequestError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AppError = void 0;
// AppError
class AppError extends Error {
    statusCode;
    isOperational;
    errors;
    constructor(message, statusCode = 500, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = statusCode < 500;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Error factories
const NotFoundError = (msg = "Resource not found") => new AppError(msg, 404);
exports.NotFoundError = NotFoundError;
const UnauthorizedError = (msg = "Unauthorized") => new AppError(msg, 401);
exports.UnauthorizedError = UnauthorizedError;
const ForbiddenError = (msg = "Forbidden") => new AppError(msg, 403);
exports.ForbiddenError = ForbiddenError;
const BadRequestError = (msg, errors = []) => new AppError(msg, 400, errors);
exports.BadRequestError = BadRequestError;
const ConflictError = (msg) => new AppError(msg, 409);
exports.ConflictError = ConflictError;
//# sourceMappingURL=app.error.js.map