"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const branch_model_1 = require("./branch.model");
class BranchRepository {
    //Create 
    async create(data) {
        const branch = new branch_model_1.BranchModel(data);
        return branch.save();
    }
    //Find head office
    async findHeadOffice(tenantId) {
        return branch_model_1.BranchModel.findOne({
            tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
            isHeadOffice: true,
            isDeleted: false,
        });
    }
    //Find by ID
    async findById(id) {
        return branch_model_1.BranchModel.findOne({
            _id: new mongoose_1.default.Types.ObjectId(id),
            isDeleted: false,
        });
    }
    //Find all by tenant
    async findAllByTenant(tenantId) {
        return branch_model_1.BranchModel.find({
            tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
            isDeleted: false,
            isActive: true,
        }).sort({ isHeadOffice: -1, createdAt: 1 });
    }
    //Update by ID
    async updateById(id, data) {
        return branch_model_1.BranchModel.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(id), isDeleted: false }, { ...data, updatedAt: new Date() }, { new: true });
    }
    //Soft delete
    async softDeleteById(id) {
        await branch_model_1.BranchModel.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(id) }, { isDeleted: true, updatedAt: new Date() });
    }
    //Check code exists within tenant
    async codeExists(tenantId, code) {
        const doc = await branch_model_1.BranchModel
            .findOne({
            tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
            code: code.toUpperCase(),
            isDeleted: false,
        })
            .select("_id")
            .lean();
        return doc !== null;
    }
}
exports.BranchRepository = BranchRepository;
//# sourceMappingURL=branch.repository.js.map