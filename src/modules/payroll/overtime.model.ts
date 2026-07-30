import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export enum OTStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum OTType {
  REGULAR  = "REGULAR",   // overtime on a normal working day
  HOLIDAY  = "HOLIDAY",   // worked on a declared public holiday
  WEEK_OFF = "WEEK_OFF",  // worked on weekly off day
}

export interface OvertimeDocument extends BaseDocument {
  employeeId:      mongoose.Types.ObjectId;
  attendanceDate:  Date;       // the specific day OT occurred
  otType:          OTType;
  standardMinutes: number;     // shift standard (e.g. 480 = 8 hrs)
  workedMinutes:   number;     // actual from attendance.workedMinutes
  otMinutes:       number;     // workedMinutes - standardMinutes (capped at max)
  otHours:         number;     // otMinutes / 60 — for display
  hourlyRate:      number;     // (Basic + DA) / (26 × standardHours)
  otMultiplier:    number;     // 2.0 regular, 2.0 or 3.0 holiday
  otAmount:        number;     // otHours × hourlyRate × multiplier
  status:          OTStatus;
  approvedBy?:     mongoose.Types.ObjectId;
  approvedAt?:     Date;
  rejectionReason?: string;
  month:           number;     // denormalized for fast payroll aggregation
  year:            number;
  notes?:          string;
}


const OvertimeSchema = createBaseSchema<OvertimeDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      ref:      "Employee",
      index:    true,
    },
    attendanceDate: {
      type:     Date,
      required: true,
    },
    otType: {
      type:    String,
      enum:    Object.values(OTType),
      default: OTType.REGULAR,
    },
    standardMinutes: { 
      type: Number, 
      required: true 
    },
    workedMinutes: { 
      type: Number, 
      required: true 
    },
    otMinutes: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    otHours: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    hourlyRate: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    otMultiplier: { 
      type: Number, 
      required: true, 
      default: 2.0 
    },
    otAmount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    status: {
      type:    String,
      enum:    Object.values(OTStatus),
      default: OTStatus.PENDING,
      index:   true,
    },
    approvedBy: { 
      type: mongoose.Schema.Types.ObjectId 
    },
    approvedAt: { 
      type: Date 
    },
    rejectionReason: { 
      type: String, trim: true 
    },
    month: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 12, 
      index: true 
    },
    year: { 
      type: Number, 
      required: true, 
      index: true 
    },
    notes: { 
      type: String, 
      trim: true 
    },
  },
  { collection: "payroll_overtimes" }
);

// One OT record per employee per day
OvertimeSchema.index(
  { tenantId: 1, employeeId: 1, attendanceDate: 1 },
  { unique: true }
);

// Fast aggregation at payroll time
OvertimeSchema.index(
  { tenantId: 1, employeeId: 1, year: 1, month: 1, status: 1 }
);

export const OvertimeModel = mongoose.model<OvertimeDocument>(
  "Overtime",
  OvertimeSchema
);