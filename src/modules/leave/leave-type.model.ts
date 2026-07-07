import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export enum LeaveAccrualFrequency {
    MONTHLY = "MONTHLY",
    YEARLY = "YEARLY",
    NONE = "NONE",          // fixed quota, no accrual — full balance granted upfront

}

export interface LeaveTypeDocument extends BaseDocument {
    name : string;          // "Casual Leave", "Sick Leave"
    code : string;          // "CL", "SL", "EL"
    description : string;
    isPaid : boolean;
    annualQuota : number;   // total days per year
    accrualFrequency : LeaveAccrualFrequency;
    accrualAmountPerCycle : number;     // days credited each accrual cycle
    maxCarryForwardDays : number;       // 0 = no carry forward allowed
    maxConsecutiveDays : number;        // 0 = no limit
    requiresApproval : boolean;
    allowNegativeBalance : boolean;
    isActive : boolean;
}

const LeaveTypeSchema = createBaseSchema<LeaveTypeDocument> (
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
            maxLength: 10,
        },
        description : {
            type : String,
            trim : true,
            default : "",
        },
        isPaid : {
            type : Boolean,
            default : true,
        },
        annualQuota : {
            type : Number,
            required : true,
            min : 0,
        },
        accrualFrequency : {
            type : String,
            enum : Object.values(LeaveAccrualFrequency),
            default : LeaveAccrualFrequency.NONE,
        },
        accrualAmountPerCycle : {
            type : Number,
            default : 0,
            min : 0,
        },
        maxCarryForwardDays : {
            type : Number,
            default : 0,
            min : 0,
        },
        maxConsecutiveDays : {
            type : Number,
            default : 0,
            min : 0,
        },
        requiresApproval : {
            type : Boolean,
            default : true,
        },
        allowNegativeBalance : {
            type : Boolean,
            default : false,
        },
        isActive : {
            type : Boolean,
            default : true,
        },
        
    },
    { collection : "leave_types"}
);

LeaveTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LeaveTypeSchema.index({ tenantId: 1, isActive: 1 });

export const LeaveTypeModel = mongoose.model<LeaveTypeDocument>(
  "LeaveType",
  LeaveTypeSchema
);