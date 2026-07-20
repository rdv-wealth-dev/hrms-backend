import mongoose, {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  ProjectionType,
  PipelineStage,
} from "mongoose";
import { RequestContext } from "../core/interfaces/request-context.interface";
import { buildPagedResponse } from "../core/database/base.schema";


export interface PaginationOptions {
  pageNumber: number;
  pageSize:   number;
}

export interface FindOptions<T> {
  sort?:       Record<string, 1 | -1>;
  projection?: ProjectionType<T>;
  populate?:   string | string[];
  baseUrl?:    string;
}

export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  protected buildTenantFilter(
    context: RequestContext,
    filter:  FilterQuery<T> = {}
  ): FilterQuery<T> {
    const tenantFilter: FilterQuery<T> = {
      ...filter,
      tenantId:  context.tenantId,
      isDeleted: false,
    } as FilterQuery<T>;

    if (context.branchIds && context.branchIds.length > 0) {
      (tenantFilter as any).branchId = {
        $in: context.branchIds,
      };
    }

    return tenantFilter;
  }

  async findAll(
    context:    RequestContext,
    filter:     FilterQuery<T> = {},
    pagination: PaginationOptions = { pageNumber: 1, pageSize: 10 },
    options:    FindOptions<T> = {}
  ) {
    const tenantFilter = this.buildTenantFilter(context, filter);

    const { pageNumber, pageSize } = pagination;
    const safePgSize = Math.min(pageSize, 100); // LPDOS guard — max 100 per page
    const skip       = (pageNumber - 1) * safePgSize;
    const sort       = options.sort ?? { createdAt: -1 };


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

    return buildPagedResponse({
      data:         data as T[],
      pageNumber,
      pageSize:     safePgSize,
      totalRecords,
      baseUrl:      options.baseUrl ?? "",
    });
  }

  async findOne(
    context: RequestContext,
    filter:  FilterQuery<T>,
    options: FindOptions<T> = {}
  ): Promise<T | null> {
    const tenantFilter = this.buildTenantFilter(context, filter);
    return this.model
      .findOne(tenantFilter, options.projection)
      .populate(options.populate ?? []) as Promise<T | null>;
  }

  async findById(
    context: RequestContext,
    id:      string,
    options: FindOptions<T> = {}
  ): Promise<T | null> {
    return this.model
      .findOne(
        {
          _id:       id,
          tenantId:  context.tenantId,
          isDeleted: false,
        } as FilterQuery<T>,
        options.projection
      )
      .populate(options.populate ?? []) as Promise<T | null>;
  }


  async create(
    context: RequestContext,
    data:    Partial<T>
  ): Promise<T> {
    const doc = new this.model({
      ...data,
      tenantId:  context.tenantId,
      createdBy: context.userId,
      updatedBy: context.userId,
    });
    return doc.save();
  }

  async createMany(
    context: RequestContext,
    data:    Partial<T>[]
  ): Promise<T[]> {
    const docs = data.map((item) => ({
      ...item,
      tenantId:  context.tenantId,
      createdBy: context.userId,
      updatedBy: context.userId,
    }));
    return this.model.insertMany(docs) as unknown as T[];
  }

  async updateById(
    context: RequestContext,
    id:      string,
    data:    UpdateQuery<T>,
    options: QueryOptions = { new: true }
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(
      {
        _id:       id,
        tenantId:  context.tenantId,
        isDeleted: false,
      } as FilterQuery<T>,
      {
        ...data,
        updatedBy: context.userId,
      },
      options
    );
  }

  async updateMany(
    context: RequestContext,
    filter:  FilterQuery<T>,
    data:    UpdateQuery<T>
  ): Promise<{ modifiedCount: number }> {
    const tenantFilter = this.buildTenantFilter(context, filter);
    const result = await this.model.updateMany(tenantFilter, {
      ...data,
      updatedBy: context.userId,
    });
    return { modifiedCount: result.modifiedCount };
  }

// soft delete , don't hard delete 
  async softDeleteById(
    context: RequestContext,
    id:      string
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(
      {
        _id:       id,
        tenantId:  context.tenantId,
        isDeleted: false,
      } as FilterQuery<T>,
      {
        isDeleted: true,
        updatedBy: context.userId,
      },
      { new: true }
    );
  }

// count
  async count(
    context: RequestContext,
    filter:  FilterQuery<T> = {}
  ): Promise<number> {
    const tenantFilter = this.buildTenantFilter(context, filter);
    return this.model.countDocuments(tenantFilter);
  }


  async exists(
    context: RequestContext,
    filter:  FilterQuery<T>
  ): Promise<boolean> {
    const tenantFilter = this.buildTenantFilter(context, filter);
    const doc = await this.model
      .findOne(tenantFilter)
      .select("_id")
      .lean();
    return doc !== null;
  }

  async findOneGlobal(
    filter:  FilterQuery<T>,
    options: FindOptions<T> = {}
  ): Promise<T | null> {
    return this.model
      .findOne(
        { ...filter, isDeleted: false },
        options.projection
      )
      .populate(options.populate ?? []) as Promise<T | null>;
  }

  async aggregate(
    context:  RequestContext,
    pipeline: PipelineStage[]
  ): Promise<unknown[]> {
    const tenantStage: PipelineStage = {
      $match: {
        tenantId:  new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      },
    };
    return this.model.aggregate([tenantStage, ...pipeline]);
  }
}