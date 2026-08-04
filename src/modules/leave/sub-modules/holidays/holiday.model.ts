import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../../shared/database/base.schema";

export enum HolidayType {
    NATIONAL = "NATIONAL",
    RESTRICTED = "RESTRICTED",   // optional/floater holidays employees can choose from
    REGIONAL = "REGIONAL",
}

// Scope determines which inheritance layer this holiday belongs to.
// Resolution priority: BRANCH (highest) → STATE → COUNTRY → GLOBAL (lowest)
export enum HolidayScope {
    GLOBAL = "GLOBAL",   // System/platform baseline — seeded at org onboarding
    COUNTRY = "COUNTRY",  // National-level holidays (e.g. India's Republic Day)
    STATE = "STATE",    // State/province-level (e.g. Karnataka Rajyotsava)
    BRANCH = "BRANCH",   // Branch-specific override — highest priority
}

export interface HolidayDocument extends OrgLevelDocument {
    name: string;         // "Diwali", "Republic Day"
    date: Date;           // normalized to midnight
    type: HolidayType;
    scope: HolidayScope;   // which inheritance layer this holiday belongs to
    isOptional: boolean;        // if true, employee must opt-in to take this off
    description?: string;
    branchId?: mongoose.Types.ObjectId;  // populated when scope = BRANCH
    countryCode?: string;                   // ISO 3166-1 alpha-2, set for COUNTRY and STATE scope
    stateCode?: string;                   // Normalized ISO state code (e.g. "KA", "MH"), set for STATE scope
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
        scope: {
            type: String,
            enum: Object.values(HolidayScope),
            default: HolidayScope.BRANCH,
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
        countryCode: {
            type: String,
            trim: true,
            uppercase: true,
        },
        stateCode: {
            type: String,
            trim: true,
            uppercase: true,
        },
    },
    { collection: "holidays" }
);

// Existing indexes — preserved
HolidaySchema.index({ tenantId: 1, branchId: 1, date: 1 });
HolidaySchema.index({ tenantId: 1, date: 1 });

// New indexes — support scope-aware resolution queries
HolidaySchema.index({ tenantId: 1, scope: 1, countryCode: 1, date: 1 });
HolidaySchema.index({ tenantId: 1, scope: 1, countryCode: 1, stateCode: 1, date: 1 });

export const HolidayModel = mongoose.model<HolidayDocument>(
    "Holiday",
    HolidaySchema
);