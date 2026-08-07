import mongoose, { mongo } from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../shared/database/base.schema";

export interface ShiftDocument extends BaseDocument {
  name:                string;   // "General Shift", "Night Shift"
  code:                string;   // "GEN", "NIGHT"
  startTime:           string;   // "09:00" — 24h format  (= toAllowedTime)
  endTime:             string;   // "18:00"
  // ─── Check-in Window ──────────────────────────────────────────────
  // Punches before allowedCheckInFromTime are accepted but effective check-in
  // for status calculation is still startTime (no early-bird bonus).
  // e.g. "08:00" — employee can punch from 8 AM; shift start is still 10 AM.
  allowedCheckInFromTime: string;  // earliest accepted punch HH:MM (default = startTime)
  // ─── Customizable Check-in Range ─────────────────────────────────────────────
  checkInWindowStart:    string;   // Earliest check-in allowed, e.g. "08:00"
  checkInWindowEnd:      string;   // Shift start check-in deadline, e.g. "10:00"
  // ─── Grace Period ────────────────────────────────────────────────────────────
  gracePeriodMinutes:    number;   // late arrival tolerance before status = LATE (per occurrence)
  graceLimitPerMonth:    number;   // max times grace can be used per month (0 = unlimited)
  // ─── Early-Leave Window ───────────────────────────────────────────────────────
  // Checkout between earlyLeaveStartTime and endTime = isCheckOutEarly=true
  //   BUT isAllowedEarlyLeave=true — no status downgrade, only flagged.
  // Checkout before earlyLeaveStartTime = penalized (status may downgrade).
  // e.g. "18:00" — leaving after 6 PM but before 7:30 PM is an allowed early leave.
  earlyLeaveStartTime:   string;  // HH:MM (default = endTime — no allowed early window)
  // ─── Monthly Soft Quotas ─────────────────────────────────────────────────────
  // Exceeding these does NOT block punches. Counts are stored in shift_quota_usage
  // and surfaced in the HR monthly attendance report as a flag.
  lateArrivalQuotaPerMonth: number;  // max LATE marks before HR flag (default 3)
  earlyLeaveQuotaPerMonth:  number;  // max early leaves before HR flag (default 3)
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
  // ─── Fully Flexible Customization Flags ──────────────────────────────────────
  halfDayWeight:             number;  // day weight for percentage calculation (default 0.5)
  rejectEarlyPunch:          boolean; // whether to reject punches before allowedCheckInFromTime (default false)
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
        firstHalfCutoffMinutes:       { type: Number, default: 240 },
        secondHalfCutoffMinutes:      { type: Number, default: 210 },
        minimumWorkMinutesForHalfDay:  { type: Number, default: 270 },
        // ─── Check-in Window & Early-Leave Window ────────────────────────────
        allowedCheckInFromTime: {
          type:  String,
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        checkInWindowStart: {
          type:  String,
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        checkInWindowEnd: {
          type:  String,
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        // earlyLeaveStartTime: checkout AFTER this but BEFORE endTime = allowed early leave
        //   (isCheckOutEarly=true, isAllowedEarlyLeave=true, no status downgrade).
        //   Checkout BEFORE this = penalized early checkout.
        //   Default = endTime (no allowed early window). e.g. "18:00" for 7:30 PM shift end.
        earlyLeaveStartTime: {
          type:  String,
          match: /^([01]\d|2[0-3]):([0-5]\d)$/,
          // default is set dynamically to endTime in the service if not provided
        },
        // ─── Monthly Soft Quotas ──────────────────────────────────────────────
        lateArrivalQuotaPerMonth: { type: Number, default: 3, min: 0 },
        earlyLeaveQuotaPerMonth:  { type: Number, default: 3, min: 0 },
        // ─── Fully Flexible Customization Defaults ────────────────────────────
        halfDayWeight:            { type: Number, default: 0.5, min: 0, max: 1 },
        rejectEarlyPunch:         { type: Boolean, default: false },
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