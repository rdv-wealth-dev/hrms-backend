import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../../shared/database/base.schema";

export enum AttendanceStatus {
    PRESENT = "PRESENT",
    LATE = "LATE",
    HALF_DAY = "HALF_DAY",
    HALF_DAY_MORNING = "HALF_DAY_MORNING",  // First half present, second half absent (early checkout)
    HALF_DAY_AFTERNOON = "HALF_DAY_AFTERNOON",  // First half absent (late arrival), second half present
    ABSENT = "ABSENT",
    ON_LEAVE = "ON_LEAVE",
    HOLIDAY = "HOLIDAY",
    WEEK_OFF = "WEEK_OFF",
}

export enum PunchSource {
    WEB = "WEB",
    MANUAL = "MANUAL",  // enter/edited by HR
    MOBILE = "MOBILE"
}

export enum SessionType {
    CHECK_IN = "CHECK_IN",
    BREAK_OUT = "BREAK_OUT",
    BREAK_IN = "BREAK_IN",
    CHECK_OUT = "CHECK_OUT"
}

export interface AttendanceSession {
    type : SessionType;
    timestamp : Date;
    source : PunchSource;
    lat? : number;
    lng? : number;
    ipAddress? : string;
    deviceInfo? : string;
    withinGeofence? : boolean | null;          // null if geofencing not enabled for the branch
}

export interface AttendanceDocument extends BaseDocument {
    employeeId:      mongoose.Types.ObjectId;
    branchId:        mongoose.Types.ObjectId;
    shiftId:         mongoose.Types.ObjectId;
    attendanceDate:  Date;        // normalized to midnight — one doc per employee per day
    sessions:        AttendanceSession[];
    firstCheckIn?:   Date;
    lastCheckOut?:   Date;
    workedMinutes:   number;      // computed from sessions
    status:          AttendanceStatus;
    isRegularized:   boolean;     // true if this day went through regularization
    regularizationReason?: string;
    notes?:          string;
    overtimeId?: mongoose.Types.ObjectId;  // populated after OT computation
    isLate?:         boolean;
    isCheckOutEarly?: boolean;
    isAllowedEarlyLeave?: boolean; // true if checkout is in the earlyLeaveStartTime→endTime window (no penalty)
    halfDayType?:    "MORNING" | "AFTERNOON"; // MORNING = 1st half present / AFTERNOON = 2nd half present
}

const AttendanceSessionSchema = new mongoose.Schema(
  {
    type : { 
        type: String, 
        enum: Object.values(SessionType), 
        required: true 
    },
    timestamp : { 
        type: Date,   
        required: true 
    },
    source : { 
        type: String, 
        enum: Object.values(PunchSource), 
        required: true 
    },
    lat : { 
        type: Number 
    },
    lng : { 
        type: Number 
    },
    ipAddress : { 
        type: String 
    },
    deviceInfo : { 
        type: String 
    },
    withinGeofence : { 
        type: Boolean, 
        default: null 
    },
  },
    { _id: false }
);

const AttendanceSchema = createBaseSchema<AttendanceDocument>(
    {
        employeeId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Employee",
            required : true,
            index : true,
        },
        branchId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Branch",
            required : true,
            index : true,
        },
        shiftId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Shift",
            required : true,
        },
        attendanceDate : {
              // Always stored as midnight UTC of the local attendance day —
      // one document per employee per day, enforced by the unique index below
            type : Date,
            required : true,
        },
        sessions : {
            type : [AttendanceSessionSchema],
            default : [],
        },
        firstCheckIn : {
            type : Date
        },
        lastCheckOut : {
            type : Date
        },
        workedMinutes : {
            type : Number,
            default : 0,
        },
        status : {
            type : String,
            enum : Object.values(AttendanceStatus),
            default : AttendanceStatus.ABSENT,
        },
        isRegularized : {
            type : Boolean,
            default : false,
        },
        regularizationReason : {
            type : String,
            trim : true
        },
        notes : {
            type : String,
            trim : true,
        },
        overtimeId: {
          type:    mongoose.Schema.Types.ObjectId,
          ref:     "Overtime",
          default: null,
        },
        isLate: {
          type:    Boolean,
          default: false,
        },
        isCheckOutEarly: {
          type:    Boolean,
          default: false,
        },
        isAllowedEarlyLeave: {
          type:    Boolean,
          default: false,
        },
        halfDayType: {
          type:    String,
          enum:    ["MORNING", "AFTERNOON"],
          default: null,
        },
    },
        {collection : "attendance"}
);


// One attendance record per employee per day — this is the core invariant
AttendanceSchema.index(
  { tenantId: 1, employeeId: 1, attendanceDate: 1 },
  { unique: true }
);

AttendanceSchema.index({ tenantId: 1, branchId: 1, attendanceDate: 1 });
AttendanceSchema.index({ tenantId: 1, status: 1 });
AttendanceSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

export const AttendanceModel = mongoose.model<AttendanceDocument>(
  "Attendance",
  AttendanceSchema
);