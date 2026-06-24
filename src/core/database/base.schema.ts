import mongoose, { Schema, Document, SchemaOptions } from "mongoose";

export interface BaseDocument extends Document {
  tenantId:   mongoose.Types.ObjectId;
  branchId:   mongoose.Types.ObjectId;   // always required — Head Office guarantees this
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted:  boolean;
  version:    number;
  createdAt:  Date;
  updatedAt:  Date;
}

export interface OrgLevelDocument extends Document {
  tenantId:   mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted:  boolean;
  version:    number;
  createdAt:  Date;
  updatedAt:  Date;
}

export const baseSchemaFields = {
  tenantId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Organization",
    required: true,
    index:    true,
  },
  branchId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Branch",
    required: true,   // Head Office always created on registration — never null
    index:    true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  },
  isDeleted: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  version: {
    type:    Number,
    default: 1,
  },
};

export const baseSchemaFieldsNoBranch = {
  tenantId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Organization",
    required: true,
    index:    true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  },
  isDeleted: {
    type:    Boolean,
    default: false,
    index:   true,
  },
  version: {
    type:    Number,
    default: 1,
  },
};


export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,   // auto createdAt + updatedAt
  versionKey: "__v",
};



function applyBaseHooks(schema: Schema): void {
  
  schema.pre("save", function (next) {
    if (!this.isNew) {
      this.version = (this.version as number) + 1;
    }
    next();
  });

  schema.pre(/^find/, function (next) {
    const query = this as mongoose.Query<unknown, unknown>;
    const conditions = query.getFilter();
    if (conditions.isDeleted === undefined) {
      query.where({ isDeleted: false });
    }
    next();
  });
}

export function createBaseSchema<T>(
  fields: mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    {
      ...baseSchemaFields,
      ...fields,
    },
    {
      ...baseSchemaOptions,
      ...options,
    }
  );

  applyBaseHooks(schema);
  return schema;
}

export function createOrgLevelSchema<T>(
  fields: mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    {
      ...baseSchemaFieldsNoBranch,
      ...fields,
    },
    {
      ...baseSchemaOptions,
      ...options,
    }
  );

  applyBaseHooks(schema);
  return schema;
}

export function createPlatformSchema<T>(
  fields: mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    {
      ...fields,
      isDeleted: {
        type:    Boolean,
        default: false,
        index:   true,
      },
      version: {
        type:    Number,
        default: 1,
      },
    },
    {
      ...baseSchemaOptions,
      ...options,
    }
  );

  applyBaseHooks(schema);
  return schema;
}

export function buildPagedResponse<T>({
  data,
  pageNumber,
  pageSize,
  totalRecords,
  baseUrl = "",
  message = null,
}: {
  data:         T[];
  pageNumber:   number;
  pageSize:     number;
  totalRecords: number;
  baseUrl?:     string;
  message?:     string | null;
}) {
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  const buildUrl = (page: number): string | null =>
    baseUrl
      ? `${baseUrl}?pageNumber=${page}&pageSize=${pageSize}`
      : null;

  return {
    succeeded:    true,
    message,
    errors:       [],
    data,
    pageNumber,
    pageSize,
    totalPages,
    totalRecords,
    firstPage:    buildUrl(1),
    lastPage:     buildUrl(totalPages),
    nextPage:     pageNumber < totalPages ? buildUrl(pageNumber + 1) : null,
    previousPage: pageNumber > 1          ? buildUrl(pageNumber - 1) : null,
  };
}

export function buildSuccessResponse<T>(
  data: T,
  message = "Success"
) {
  return {
    succeeded: true,
    message,
    errors:    [],
    data,
  };
}

export function buildErrorResponse(
  message: string,
  errors: string[] = []
) {
  return {
    succeeded: false,
    message,
    errors,
    data:      null,
  };
}