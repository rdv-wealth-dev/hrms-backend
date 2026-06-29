"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const security_middleware_1 = require("./core/middlewares/security.middleware");
const request_id_middleware_1 = require("./core/middlewares/request-id.middleware");
const error_middleware_1 = require("./core/errors/error.middleware");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const organization_routes_1 = __importDefault(require("./modules/organization/organization.routes"));
const branch_routes_1 = __importDefault(require("./modules/branch/branch.routes"));
const app = (0, express_1.default)();
app.use(request_id_middleware_1.requestIdMiddleware);
// apply securityMiddleware
(0, security_middleware_1.applySecurityMiddleware)(app);
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/organizations", organization_routes_1.default);
app.use("/api/v1/branches", branch_routes_1.default);
app.get("/health", (_req, res) => {
    res.status(200).json({
        succeeded: true,
        message: "HRMS Api Running",
        data: {
            status: "ok",
            timeStamp: new Date().toISOString(),
        }
    });
});
app.use(error_middleware_1.globalErrorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map