"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const logger_1 = require("./logger");
const connectDatabase = async () => {
    try {
        await mongoose_1.default.connect(env_1.env.connectionString, {
            dbName: env_1.env.connectionStringName,
        });
        logger_1.logger.info(`Database Connected Successfully (${env_1.env.connectionStringName})`);
    }
    catch (error) {
        logger_1.logger.error(`Database Connection Failed: ${error}`);
        process.exit(1);
    }
};
exports.connectDatabase = connectDatabase;
//# sourceMappingURL=database.js.map