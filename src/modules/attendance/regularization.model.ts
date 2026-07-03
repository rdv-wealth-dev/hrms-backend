import mongoose, { mongo } from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export enum RegularizationStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

export interface RegularizationDocument extends BaseDocument {
  employeeId:      mongoose.Types.ObjectId;
  attendanceId:    mongoose.Types.ObjectId;
  attendanceDate:  Date;
  requestedCheckIn?:  Date;
  requestedCheckOut?: Date;
  reason:          string;
  status:          RegularizationStatus;
  reviewedBy?:     mongoose.Types.ObjectId;
  reviewedAt?:     Date;
  reviewComments?: string;
}

const RegularizationSchema = createBaseSchema<RegularizationDocument>(
    {
        employeeId : {
            type : mongoose.Schema.Types.ObjectId,
            required : true,
            index : true,
        },
        attendanceId : {
            type : mongoose.Schema.Types.ObjectId,
            required : true,
        },
        attendanceDate : {
            type : Date,
            required : true,
        },
        requestedCheckIn : {
            type : Date,
        },
        requestedCheckOut : {
            type : Date,
        },
        reason : {
            type : String,
            required : true,
            trim : true,
            maxLength : 500,
        },
        status : {
            type : String,
            enum : Object.values(RegularizationStatus),
            default : RegularizationStatus.PENDING,
        },
        reviewedBy : {
            type : mongoose.Schema.Types.ObjectId,
        },
        reviewedAt : {
            type : Date,
        },
        reviewComments : {
            type : String,
            trim : true
        },
        
    },
    { collection : "attendance_regularizations"}
);


RegularizationSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
RegularizationSchema.index({ tenantId: 1, status: 1 });
RegularizationSchema.index({ tenantId: 1, attendanceId: 1 });


export const RegularizationModel = mongoose.model<RegularizationDocument>(
    "Regularization",
    RegularizationSchema
);