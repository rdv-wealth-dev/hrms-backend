"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validate_middleware_1 = require("../../core/validators/validate.middleware");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const security_middleware_1 = require("../../core/middlewares/security.middleware");
const auth_dto_1 = require("./auth.dto");
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
//Public routes — no auth require
// POST /api/v1/auth/register
router.post("/register", (0, validate_middleware_1.validateBody)(auth_dto_1.RegisterDto), controller.register.bind(controller));
// POST /api/v1/auth/login
router.post("/login", security_middleware_1.authLimiter, // max 10 attempts per 15 min
(0, validate_middleware_1.validateBody)(auth_dto_1.LoginDto), controller.login.bind(controller));
// POST /api/v1/auth/refresh
router.post("/refresh", (0, validate_middleware_1.validateBody)(auth_dto_1.RefreshTokenDto), controller.refresh.bind(controller));
// POST /api/v1/auth/forgot-password
router.post("/forgot-password", (0, validate_middleware_1.validateBody)(auth_dto_1.ForgotPasswordDto), controller.forgotPassword.bind(controller));
// POST /api/v1/auth/reset-password
router.post("/reset-password", (0, validate_middleware_1.validateBody)(auth_dto_1.ResetPasswordDto), controller.resetPassword.bind(controller));
//Protected routes — auth required
// GET /api/v1/auth/me
router.get("/me", auth_middleware_1.authenticate, controller.getMe.bind(controller));
// POST /api/v1/auth/logout
router.post("/logout", auth_middleware_1.authenticate, controller.logout.bind(controller));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map