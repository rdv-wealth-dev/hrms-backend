import mongoose from "mongoose";
import { createBaseSchema, BaseDocument, } from "../../core/database/base.schema";

// DESIGNATION DOCUMENT INTERFACE

export interface DesignationDocument extends BaseDocument {
  name:         string;
  code:         string;
  description:  string;
  departmentId: mongoose.Types.ObjectId;
  level:        number;   // seniority level — 1 = junior, 5 = senior
  isActive:     boolean;
}

// DESIGNATION SCHEMA

const DesignationSchema = createBaseSchema<DesignationDocument>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    code: {
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
    departmentId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    level: {
      // Seniority level
      // 1 = Intern, 2 = Junior, 3 = Mid, 4 = Senior, 5 = Lead
      type:    Number,
      default: 1,
      min:     1,
      max:     10,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "designations" }
);

// Indexes
DesignationSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });
DesignationSchema.index({ tenantId: 1, departmentId: 1 });
DesignationSchema.index({ tenantId: 1, isActive: 1 });

export const DesignationModel = mongoose.model<DesignationDocument>(
  "Designation",
  DesignationSchema
);