import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

// OVERTIME STATUS ENUM

export enum OTStatus {
  PENDING  = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

// OVERTIME DOCUMENT MODEL
// Records hours worked and payment computed for approved overtime requests

export interface OvertimeDocument extends BaseDocument {
  employeeId: mongoose.Types.ObjectId;
  year:       number;
  month:      number; // 1-12
  hours:      number;
  otAmount:   number;
  status:     OTStatus;
  notes?:     string;
}

const OvertimeSchema = createBaseSchema<OvertimeDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      ref:      "Employee",
      index:    true,
    },
    year: {
      type:     Number,
      required: true,
      index:    true,
    },
    month: {
      type:     Number,
      required: true,
      min:      1,
      max:      12,
      index:    true,
    },
    hours: {
      type:     Number,
      required: true,
      min:      0,
    },
    otAmount: {
      type:     Number,
      required: true,
      min:      0,
    },
    status: {
      type:    String,
      enum:    Object.values(OTStatus),
      default: OTStatus.PENDING,
      index:   true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { collection: "payroll_overtimes" }
);

export const OvertimeModel = mongoose.model<OvertimeDocument>(
  "Overtime",
  OvertimeSchema
);
