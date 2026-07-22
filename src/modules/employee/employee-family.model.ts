import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema";

export enum FamilyRelationship {
    SPOUSE = "SPOUSE",
    CHILD = "CHILD",
    FATHER = "FATHER",
    MOTHER = "MOTHER",
    SIBLING = "SIBLING",
    OTHER = "OTHER",
}

export interface EmployeeFamilyMemberDocument extends BaseDocument {
    employeeId: mongoose.Types.ObjectId;
    fullName: string;
    relationship: FamilyRelationship;
    dateOfBirth?: Date;
    gender?: string;
    isDependent: boolean;   // for insurance/tax declarations
    occupation?: string;
    phone?: string;
    isNominee: boolean;   // for gratuity/PF nomination
}

const EmployeeFamilySchema = createBaseSchema<EmployeeFamilyMemberDocument>(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        relationship: {
            type: String,
            enum: Object.values(FamilyRelationship),
            required: true,
        },
        dateOfBirth: { type: Date },
        gender: { type: String, trim: true },
        isDependent: { type: Boolean, default: true },
        occupation: { type: String, trim: true },
        phone: { type: String, trim: true },
        isNominee: { type: Boolean, default: false },
    },
    { collection: "employee_family_members" }
);

EmployeeFamilySchema.index({ tenantId: 1, employeeId: 1 });

export const EmployeeFamilyModel = mongoose.model<EmployeeFamilyMemberDocument>(
    "EmployeeFamilyMember",
    EmployeeFamilySchema
);