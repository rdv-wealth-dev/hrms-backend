import mongoose, { mongo } from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export interface ShiftDocument extends BaseDocument {
  name:                string;   // "General Shift", "Night Shift"
  code:                string;   // "GEN", "NIGHT"
  startTime:           string;   // "09:00" — 24h format
  endTime:             string;   // "18:00"
  gracePeriodMinutes:  number;   // late arrival tolerance before status = LATE
  halfDayThresholdMinutes: number; // worked minutes below this = HALF_DAY
  fullDayMinutes:      number;   // expected worked minutes for a full day
  breakDurationMinutes: number;  // standard break allowance, informational
  isDefault:           boolean;  // auto-assigned shift for new employees
  isActive:            boolean;
}


const ShiftSchema = createBaseSchema<ShiftDocument>(
    {
        name : {
            type : String,
            required : true,
            trim : true,
            maxLength : 100,
        },
        code : {
            type : String,
            required : true,
            trim : true,
            uppercase : true,
            maxLength : 20,
        },
        startTime : {
            type : String,
            required : true,
            match : /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        endTime : {
            type : String,
            required : true,
            match : /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        gracePeriodMinutes : {
            type : Number,
            default : 15,
            min : 0,
            max : 120,
        },
        halfDayThresholdMinutes : {
            type : Number,
            default : 240,
        },
        fullDayMinutes : {
            type : Number,
            default : 480,  // 8 hours
        },
        breakDurationMinutes : {
            type : Number,
            default : 60,
        },
        isDefault : {
            type : Boolean,
            default : false,
        },
        isActive : {
            type : Boolean,
            default : true
        },
    },
    {collection: "shifts"}
);

ShiftSchema.index({ tenantId : 1, code : 1}, { unique : true});
ShiftSchema.index({ tenantId  : 1, isDefault : 1});
ShiftSchema.index({ tenantId : 1, isActive : 1});

export const ShiftModel = mongoose.model<ShiftDocument>(
    "Shift",
    ShiftSchema
);