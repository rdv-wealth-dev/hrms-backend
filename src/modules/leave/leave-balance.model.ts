import mongoose, { mongo } from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export interface LeaveBalanceDocument extends BaseDocument {
    employeeId : mongoose.Types.ObjectId;
    leaveTypeId : mongoose.Types.ObjectId;
    year : number;
    allocated : number;
    carriedForward : number;
    used : number;
    pending : number;
    available : number;
    lastAccrualDate? : Date;
}

const LeaveBalanceSchema = createBaseSchema<LeaveBalanceDocument> (
    {
        employeeId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Employee",
            required : true,
            index : true,
        },
        leaveTypeId :{
            type : mongoose.Schema.Types.ObjectId,
            ref : "LeaveType",
            required : true,
            index : true,
        },
        year : {
            type : Number,
            required : true,
        },
        allocated : {
            type : Number,
            default : 0,
        },
        carriedForward : {
            type : Number,
            default : 0,
        },
        used : {
            type : Number,
            default : 0,
        },
        pending : {
            type : Number,
            default : 0,
        },
        available : {
            type : Number,
            default : 0,
        },
        lastAccrualDate : {
            type : Date,
        },
    },
    { collection : "leave_balances"}
);

// One balance record per employee, per leave type, per year — the core invariant
LeaveBalanceSchema.index(
  { tenantId: 1, employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true }
);
LeaveBalanceSchema.index({ tenantId: 1, employeeId: 1, year: 1 });

export const LeaveBalanceModel = mongoose.model<LeaveBalanceDocument>(
  "LeaveBalance",
  LeaveBalanceSchema
);