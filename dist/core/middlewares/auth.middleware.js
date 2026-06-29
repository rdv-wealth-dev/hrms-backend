"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_error_1 = require("../errors/app.error");
const env_1 = require("../../config/env");
// Verify jwt + inject req.context
const authenticate = async (req, _res, next) => {
    try {
        // extract token from Authentication header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            throw new app_error_1.AppError("No token provided", 401);
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            throw new app_error_1.AppError("Invalid token format..!!", 401);
        }
        // verify token
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        // inject context - available in all controller + service
        req.context = {
            tenantId: decoded.tenantId,
            userId: decoded.userId,
            role: decoded.role,
            branchIds: decoded.branchIds,
            permissions: decoded.permissions,
            requestId: req.requestId
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.middleware.js.map