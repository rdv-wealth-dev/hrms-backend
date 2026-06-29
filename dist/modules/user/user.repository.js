"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const base_repository_1 = require("../../repositories/base.repository");
const user_model_1 = require("./user.model");
class UserRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(user_model_1.UserModel);
    }
    // Find by email — used for login 
    // Uses findOneGlobal — no tenant context exists yet at login time
    async findByEmail(email) {
        return user_model_1.UserModel
            .findOne({ email: email.toLowerCase(), isDeleted: false })
            .select("+passwordHash") // explicitly include passwordHash for comparison
            .lean();
    }
    // Find by email within tenant
    // Used during registration to check duplicate email
    async findByEmailAndTenant(email, tenantId) {
        return user_model_1.UserModel
            .findOne({
            email: email.toLowerCase(),
            tenantId,
            isDeleted: false,
        })
            .lean();
    }
    // Update last login timestamp 
    async updateLastLogin(userId) {
        await user_model_1.UserModel.updateOne({ _id: userId }, { lastLoginAt: new Date() });
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user.repository.js.map