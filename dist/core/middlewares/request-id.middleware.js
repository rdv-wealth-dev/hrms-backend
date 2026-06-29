"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const crypto_1 = require("crypto");
const requestIdMiddleware = (req, _res, next) => {
    req.requestId = req.headers["x-request-id"] ?? (0, crypto_1.randomUUID)();
    // Send it back in response headers
    // So Postman / frontend can trace the request
    _res.setHeader("x-request-id", req.requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
//# sourceMappingURL=request-id.middleware.js.map