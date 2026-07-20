import mongoose, { Schema } from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

export interface EventDocument extends OrgLevelDocument {
  title: string;
  description?: string;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
}

const EventSchema = createOrgLevelSchema<EventDocument>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  date: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  branchId: {
    type: Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
  },
});

EventSchema.index({ tenantId: 1, date: 1 });

export const EventModel = mongoose.model<EventDocument>("Event", EventSchema);
