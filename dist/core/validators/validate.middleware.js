"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateBody = void 0;
const zod_1 = require("zod");
const app_error_1 = require("../errors/app.error");
// Validate request body
// Usage: router.post("/", validateBody(CreateEmployeeDto), controller)
const validateBody = (schema) => {
    return (req, _res, next) => {
        try {
            // parse() validates AND transforms the data
            // It strips unknown fields — mass assignment protection
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
                next(new app_error_1.AppError("Validation failed", 400, errors));
                return;
            }
            next(error);
        }
    };
};
exports.validateBody = validateBody;
//Validate query params
// Usage: router.get("/", validateQuery(ListEmployeeQuery), controller)
const validateQuery = (schema) => {
    return (req, _res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
                next(new app_error_1.AppError("Invalid query parameters", 400, errors));
                return;
            }
            next(error);
        }
    };
};
exports.validateQuery = validateQuery;
//Validate route params
// Usage: router.get("/:id", validateParams(IdParamDto), controller)
const validateParams = (schema) => {
    return (req, _res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
                next(new app_error_1.AppError("Invalid route parameters", 400, errors));
                return;
            }
            next(error);
        }
    };
};
exports.validateParams = validateParams;
//# sourceMappingURL=validate.middleware.js.map