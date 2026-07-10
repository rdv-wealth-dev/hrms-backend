import mongoose, { Schema, Document, SchemaOptions } from "mongoose";

// INTERFACES

export interface BaseDocument extends Document {
  tenantId:   mongoose.Types.ObjectId;
  branchId:   mongoose.Types.ObjectId;
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

// BASE SCHEMA FIELDS

export const baseSchemaFields = {
  tenantId: {
    type:     mongoose.Schema.Types.ObjectId,
    // ref removed — no population needed at base level
    // prevents ref validation issues during seeding
    required: true,
    index:    true,
  },
  branchId: {
    type:     mongoose.Schema.Types.ObjectId,
    required: true,
    index:    true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
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

// For org-level collections — no branchId
export const baseSchemaFieldsNoBranch = {
  tenantId: {
    type:     mongoose.Schema.Types.ObjectId,
    // ref removed — prevents Mongoose ref validation
    // during seeding when org may not be committed yet
    required: true,
    index:    true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
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

// BASE SCHEMA OPTIONS

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: "__v",
};

// HOOKS — applied to every schema

function applyBaseHooks(schema: Schema): void {

  // Auto-increment version on every update
  schema.pre("save", function (next) {
    if (!this.isNew) {
      this.version = (this.version as number) + 1;
    }
    next();
  });

  // Auto-filter soft deleted docs on every find
  schema.pre(/^find/, function (next) {
    const query      = this as mongoose.Query<unknown, unknown>;
    const conditions = query.getFilter();
    if (conditions.isDeleted === undefined) {
      query.where({ isDeleted: false });
    }
    next();
  });
}

// SCHEMA FACTORIES

// For branch-level collections
// employees · attendance · leave · payroll · departments · designations
export function createBaseSchema<T>(
  fields:  mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    { ...baseSchemaFields, ...fields },
    { ...baseSchemaOptions, ...options }
  );
  applyBaseHooks(schema);
  return schema;
}

// For org-level collections — no branchId
// organizations · roles · users · audit_logs · leave_types · salary_components
export function createOrgLevelSchema<T>(
  fields:  mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    { ...baseSchemaFieldsNoBranch, ...fields },
    { ...baseSchemaOptions, ...options }
  );
  applyBaseHooks(schema);
  return schema;
}

// For platform-level collections — no tenantId, no branchId
// permissions · subscription_plans
export function createPlatformSchema<T>(
  fields:  mongoose.SchemaDefinition<T>,
  options: mongoose.SchemaOptions = {}
): Schema {
  const schema = new Schema(
    {
      ...fields,
      isDeleted: { type: Boolean, default: false, index: true },
      version:   { type: Number,  default: 1 },
    },
    { ...baseSchemaOptions, ...options }
  );
  applyBaseHooks(schema);
  return schema;
}

// RESPONSE BUILDERS

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
  data:    T,
  message = "Success"
) {
  return { succeeded: true, message, errors: [], data };
}
export function buildErrorResponse(
  message:   string,
  errors:    string[] = [],
  errorCode: string   = "SYSTEM_INTERNAL_ERROR"
) {
  return {
    // console.log(data)
    succeeded: false,
    message,
    errorCode,
    errors,
    data:      null,
  };
}