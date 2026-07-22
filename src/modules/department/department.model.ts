import mongoose from "mongoose";
import { createBaseSchema, BaseDocument, } from "../../core/database/base.schema";

// DEPARTMENT DOCUMENT INTERFACE

export interface DepartmentDocument extends BaseDocument {
  name:        string;
  code:        string;
  description: string;
  headId?:     mongoose.Types.ObjectId; // employee who heads this department
  parentId?:   mongoose.Types.ObjectId; // parent department — for hierarchy
  isActive:    boolean;
}

// DEPARTMENT SCHEMA
// Uses createBaseSchema — departments belong to a branch

const DepartmentSchema = createBaseSchema<DepartmentDocument>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    code: {
      // Short identifier — "ENG", "HR", "FIN"
      type:      String,
      required:  true,
      trim:      true,
      uppercase: true,
      maxlength: 20,
    },
    description: {
      type:    String,
      trim:    true,
      default: "",
    },
    headId: {
      // Employee who heads this department
      // Optional — set after employees are created
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },
    parentId: {
      // Parent department for nested structure
      // e.g. Frontend under Engineering
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Department",
      default: null,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "departments" }
);

//Indexes
DepartmentSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ tenantId: 1, branchId: 1 });
DepartmentSchema.index({ tenantId: 1, isActive: 1 });

export const DepartmentModel = mongoose.model<DepartmentDocument>(
  "Department",
  DepartmentSchema
);