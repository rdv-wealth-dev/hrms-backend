"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleRepository = void 0;
const base_repository_1 = require("../../repositories/base.repository");
const role_model_1 = require("./role.model");
class RoleRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(role_model_1.RoleModel);
    }
    // Find by slug within tenant
    async findBySlug(context, slug) {
        return this.findOne(context, { slug: slug.toUpperCase() });
    }
    // Find all system roles
    async findSystemRoles(context) {
        const result = await this.findAll(context, { isSystemRole: true }, { pageNumber: 1, pageSize: 100 });
        return result.data;
    }
    // Get permissions for a role slug
    // Used on login to load permissions dynamically
    async getPermissionsBySlug(tenantId, slug) {
        const role = await role_model_1.RoleModel.findOne({
            tenantId,
            slug: slug.toUpperCase(),
            isActive: true,
            isDeleted: false,
        }).select("permissions");
        return role?.permissions ?? [];
    }
}
exports.RoleRepository = RoleRepository;
//# sourceMappingURL=role.repository.js.map