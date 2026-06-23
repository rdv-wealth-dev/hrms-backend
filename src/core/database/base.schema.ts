import { SchemaOptions } from "mongoose";

export const baseSchemaFields = {
  tenantId: {
    type: String,
    required: true,
    index: true,
  },

  createdBy: {
    type: String,
    default: null,
  },

  updatedBy: {
    type: String,
    default: null,
  },

  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
};

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
};