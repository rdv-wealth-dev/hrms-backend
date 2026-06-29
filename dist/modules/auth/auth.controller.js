"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const base_schema_1 = require("../../core/database/base.schema");
const app_error_1 = require("../../core/errors/app.error");
const authService = new auth_service_1.AuthService();
class AuthController {
    // POST /api/v1/auth/register
    async register(req, res, next) {
        try {
            const result = await authService.register(req.body);
            res.status(201).json((0, base_schema_1.buildSuccessResponse)(result, "Company registered successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    //POST /api/v1/auth/login
    async login(req, res, next) {
        try {
            const result = await authService.login(req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Login successful"));
        }
        catch (error) {
            next(error);
        }
    }
    //POST /api/v1/auth/refresh
    async refresh(req, res, next) {
        try {
            const result = await authService.refreshToken(req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Token refreshed successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    //GET /api/v1/auth/me
    async getMe(req, res, next) {
        try {
            if (!req.context?.userId) {
                next(new app_error_1.AppError("Unauthorized", 401));
                return;
            }
            const result = await authService.getMe(req.context.userId);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Profile fetched successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/auth/forgot-password
    async forgotPassword(req, res, next) {
        try {
            const result = await authService.forgotPassword(req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, result.message));
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/auth/reset-password
    async resetPassword(req, res, next) {
        try {
            const result = await authService.resetPassword(req.body);
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(result, "Password reset successful"));
        }
        catch (error) {
            next(error);
        }
    }
    // POST /api/v1/auth/logout
    async logout(_req, res, next) {
        try {
            // Token discarded on client side
            // Redis jti blacklist added in Phase 12
            res.status(200).json((0, base_schema_1.buildSuccessResponse)(null, "Logged out successfully"));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map