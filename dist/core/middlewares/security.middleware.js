"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = void 0;
exports.applySecurityMiddleware = applySecurityMiddleware;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Auth rate limiter — exported separately
// Applied directly on auth routes: router.post("/login", authLimiter, controller)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 login attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        succeeded: false,
        message: "Too many auth attempts. Please try again later.",
        errors: [],
        data: null,
    },
});
// Apply all security middleware to app
function applySecurityMiddleware(app) {
    // Helmet — security headers
    app.use((0, helmet_1.default)());
    // CORS — allow all origins (dev mode)
    app.use((0, cors_1.default)());
    // Body parser — size limits prevent LPDOS attacks
    app.use(express_1.default.json({ limit: "10kb" }));
    app.use(express_1.default.urlencoded({ extended: true, limit: "10kb" }));
    // Global rate limiter — 100 req / 15 min per IP
    app.use((0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            succeeded: false,
            message: "Too many requests. Please try again later.",
            errors: [],
            data: null,
        },
    }));
}
//# sourceMappingURL=security.middleware.js.map