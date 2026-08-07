import mongoose, { mongo } from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../shared/database/base.schema";

export interface ShiftDocument extends BaseDocument {
  name:                string;   // "General Shift", "Night Shift"
  code:                string;   // "GEN", "NIGHT"
  startTime:           string;   // "09:00" — 24h format
  endTime:             string;   // "18:00"
  gracePeriodMinutes:    number;   // late arrival tolerance before status = LATE (per occurrence)
  graceLimitPerMonth:    number;   // max times grace can be used per month (0 = unlimited)
  halfDayThresholdMinutes: number; // worked minutes below this = HALF_DAY (duration-based)
  fullDayMinutes:      number;   // expected worked minutes for a full day
  breakDurationMinutes: number;  // standard break allowance, informational
  isDefault:           boolean;  // auto-assigned shift for new employees
  isActive:            boolean;
  absentThresholdMinutes:    number;  // minutes after shift start = ABSENT (default 255)
  lateArrivalHalfDayMinutes: number; // minutes after shift start = HALF_DAY on arrival (default 90)
  // ─── New Cutoff & Minimum Thresholds ────────────────────────────────────────
  firstHalfCutoffMinutes:    number;  // max minutes after shift start for 2nd-half credit (default 240 = 4 hrs)
  secondHalfCutoffMinutes:   number;  // min minutes worked from shift start for 1st-half credit on early exit (default 210 = 3.5 hrs)
  minimumWorkMinutesForHalfDay: number; // absolute minimum worked minutes for HALF_DAY; below = ABSENT (default 270 = 4.5 hrs)
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
        graceLimitPerMonth : {
            type : Number,
            default : 0,
            min : 0,
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
        absentThresholdMinutes:    { type: Number, default: 255 },
        lateArrivalHalfDayMinutes: { type: Number, default: 90  },
        // ─── Cutoff & Minimum Thresholds (industry-standard) ─────────────────
        // firstHalfCutoffMinutes: latest arrival (offset from shift start) that still qualifies
        //   for 2nd-half credit  →  default 240 mins = 4 hrs past shift start.
        //   e.g. shift=10:00 → cutoff = 14:00 (2 PM)
        firstHalfCutoffMinutes:       { type: Number, default: 240 },
        // secondHalfCutoffMinutes: minimum worked time from shift start before which an early
        //   checkout still gets 1st-half credit  →  default 210 mins = 3.5 hrs.
        //   e.g. shift=10:00 → 10:00+3.5h = 13:30 (1:30 PM). Checkout at or after = 1st half OK.
        secondHalfCutoffMinutes:      { type: Number, default: 210 },
        // minimumWorkMinutesForHalfDay: absolute floor — worked below this → ABSENT (not HALF_DAY)
        //   default 270 mins = 4.5 hrs
        minimumWorkMinutesForHalfDay:  { type: Number, default: 270 },
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