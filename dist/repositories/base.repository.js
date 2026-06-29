"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("../core/database/base.schema");
class BaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    buildTenantFilter(context, filter = {}) {
        const tenantFilter = {
            ...filter,
            tenantId: context.tenantId,
            isDeleted: false,
        };
        if (context.branchIds && context.branchIds.length > 0) {
            tenantFilter.branchId = {
                $in: context.branchIds,
            };
        }
        return tenantFilter;
    }
    async findAll(context, filter = {}, pagination = { pageNumber: 1, pageSize: 10 }, options = {}) {
        const tenantFilter = this.buildTenantFilter(context, filter);
        const { pageNumber, pageSize } = pagination;
        const safePgSize = Math.min(pageSize, 100); // LPDOS guard — max 100 per page
        const skip = (pageNumber - 1) * safePgSize;
        const sort = options.sort ?? { createdAt: -1 };
        const [data, totalRecords] = await Promise.all([
            this.model
                .find(tenantFilter, options.projection)
                .sort(sort)
                .skip(skip)
                .limit(safePgSize)
                .populate(options.populate ?? [])
                .lean(),
            this.model.countDocuments(tenantFilter),
        ]);
        return (0, base_schema_1.buildPagedResponse)({
            data: data,
            pageNumber,
            pageSize: safePgSize,
            totalRecords,
            baseUrl: options.baseUrl ?? "",
        });
    }
    async findOne(context, filter, options = {}) {
        const tenantFilter = this.buildTenantFilter(context, filter);
        return this.model
            .findOne(tenantFilter, options.projection)
            .populate(options.populate ?? []);
    }
    async findById(context, id, options = {}) {
        return this.model
            .findOne({
            _id: id,
            tenantId: context.tenantId,
            isDeleted: false,
        }, options.projection)
            .populate(options.populate ?? []);
    }
    async create(context, data) {
        const doc = new this.model({
            ...data,
            tenantId: context.tenantId,
            createdBy: context.userId,
            updatedBy: context.userId,
        });
        return doc.save();
    }
    async createMany(context, data) {
        const docs = data.map((item) => ({
            ...item,
            tenantId: context.tenantId,
            createdBy: context.userId,
            updatedBy: context.userId,
        }));
        return this.model.insertMany(docs);
    }
    async updateById(context, id, data, options = { new: true }) {
        return this.model.findOneAndUpdate({
            _id: id,
            tenantId: context.tenantId,
            isDeleted: false,
        }, {
            ...data,
            updatedBy: context.userId,
        }, options);
    }
    async updateMany(context, filter, data) {
        const tenantFilter = this.buildTenantFilter(context, filter);
        const result = await this.model.updateMany(tenantFilter, {
            ...data,
            updatedBy: context.userId,
        });
        return { modifiedCount: result.modifiedCount };
    }
    // soft delete , don't hard delete 
    async softDeleteById(context, id) {
        return this.model.findOneAndUpdate({
            _id: id,
            tenantId: context.tenantId,
            isDeleted: false,
        }, {
            isDeleted: true,
            updatedBy: context.userId,
        }, { new: true });
    }
    // count
    async count(context, filter = {}) {
        const tenantFilter = this.buildTenantFilter(context, filter);
        return this.model.countDocuments(tenantFilter);
    }
    async exists(context, filter) {
        const tenantFilter = this.buildTenantFilter(context, filter);
        const doc = await this.model
            .findOne(tenantFilter)
            .select("_id")
            .lean();
        return doc !== null;
    }
    async findOneGlobal(filter, options = {}) {
        return this.model
            .findOne({ ...filter, isDeleted: false }, options.projection)
            .populate(options.populate ?? []);
    }
    async aggregate(context, pipeline) {
        const tenantStage = {
            $match: {
                tenantId: new mongoose_1.default.Types.ObjectId(context.tenantId),
                isDeleted: false,
            },
        };
        return this.model.aggregate([tenantStage, ...pipeline]);
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=base.repository.js.map