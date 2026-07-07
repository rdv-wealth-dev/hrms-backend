import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../core/database/base.schema";

export enum CompOffSourceType {
  PUBLIC_HOLIDAY = "PUBLIC_HOLIDAY",
  WEEKLY_OFF     = "WEEKLY_OFF",
}

export enum CompOffStatus {
  AVAILABLE = "AVAILABLE",
  USED      = "USED",
  EXPIRED   = "EXPIRED",
}

export interface CompOffDocument extends BaseDocument {
  employeeId:            mongoose.Types.ObjectId;
  workDate:              Date;             // the holiday/weekoff date they actually worked
  sourceType:            CompOffSourceType;
  creditedDate:          Date;
  expiryDate:            Date;             // configurable per tenant — comp-off lapses after N days
  status:                CompOffStatus;
  usedInLeaveRequestId?: mongoose.Types.ObjectId;  // linked once redeemed
}

const CompOffSchema = createBaseSchema<CompOffDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    workDate: {
      type:     Date,
      required: true,
    },
    sourceType: {
      type:     String,
      enum:     Object.values(CompOffSourceType),
      required: true,
    },
    creditedDate: {
      type:    Date,
      default: Date.now,
    },
    expiryDate: {
      type:     Date,
      required: true,
    },
    status: {
      type:    String,
      enum:    Object.values(CompOffStatus),
      default: CompOffStatus.AVAILABLE,
    },
    usedInLeaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { collection: "comp_off_ledger" }
);

CompOffSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
CompOffSchema.index({ tenantId: 1, expiryDate: 1, status: 1 });

export const CompOffModel = mongoose.model<CompOffDocument>(
  "CompOff",
  CompOffSchema
);