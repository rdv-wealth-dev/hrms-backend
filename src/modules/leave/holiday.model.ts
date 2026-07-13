import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../core/database/base.schema";

export enum HolidayType {
    NATIONAL = "NATIONAL",
    RESTRICTED = "RESTRICTED",   // optional/floater holidays employees can choose from
    REGIONAL = "REGIONAL",
}

export interface HolidayDocument extends OrgLevelDocument {
    name: string;         // "Diwali", "Republic Day"
    date: Date;           // normalized to midnight
    type: HolidayType;
    isOptional: boolean;    // if true, employee must opt-in to take this off
    description?: string;
    branchId?: mongoose.Types.ObjectId; // optional — org-wide if omitted
}

const HolidaySchema = createOrgLevelSchema<HolidayDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        date: {
            type: Date,
            required: true,
        },
        type: {
            type: String,
            enum: Object.values(HolidayType),
            default: HolidayType.NATIONAL,
        },
        isOptional: {
            type: Boolean,
            default: false,
        },
        description: {
            type: String,
            trim: true,
        },
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
        },
    },
    { collection: "holidays" }
);

// One holiday entry per date per branch (branch-specific holiday calendars supported)
HolidaySchema.index({ tenantId: 1, branchId: 1, date: 1 });
HolidaySchema.index({ tenantId: 1, date: 1 });

export const HolidayModel = mongoose.model<HolidayDocument>(
    "Holiday",
    HolidaySchema
);