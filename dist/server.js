"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const database_1 = require("./config/database");
const permission_seed_1 = require("./modules/permission/permission.seed");
const bootstrap = async () => {
    await (0, database_1.connectDatabase)();
    // Seed platform permissions on every startup
    // Safe — upsert only, skips existing
    await (0, permission_seed_1.seedPermissions)();
    app_1.default.listen(env_1.env.port, () => {
        logger_1.logger.info(`Server running on ${env_1.env.port}`);
    });
};
bootstrap();
//# sourceMappingURL=server.js.map