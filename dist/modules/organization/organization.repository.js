"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationRepository = void 0;
const organization_model_1 = require("./organization.model");
class OrganizationRepository {
    // Organization has no tenantId — it IS the tenant
    // So it does not extend BaseRepository
    // All methods query directly on OrganizationModel
    //Create
    async create(data) {
        const org = new organization_model_1.OrganizationModel(data);
        return org.save();
    }
    //Find by ID
    async findById(id) {
        return organization_model_1.OrganizationModel.findOne({
            _id: id,
            isDeleted: false,
        });
    }
    //Find by slug 
    async findBySlug(slug) {
        return organization_model_1.OrganizationModel.findOne({ slug, isDeleted: false });
    }
    //Check slug exists
    async slugExists(slug) {
        const doc = await organization_model_1.OrganizationModel.findOne({ slug }).select("_id").lean();
        return doc !== null;
    }
    //Update
    async updateById(id, data) {
        return organization_model_1.OrganizationModel.findByIdAndUpdate(id, { ...data }, { new: true });
    }
}
exports.OrganizationRepository = OrganizationRepository;
//# sourceMappingURL=organization.repository.js.map