import mongoose from "mongoose";
import {createBaseSchema, BaseDocument } from "../../core/database/base.schema"

export enum EmployeeStatus {
    ACTIVE     = "ACTIVE",
    INACTIVE   = "INACTIVE",
    ON_LEAVE   = "ON_LEAVE",
    TERMINATED = "TERMINATED",
    RESIGNED   = "RESIGNED",
}

export enum EmployeeType {
    FULL_TIME  = "FULL_TIME",
    PART_TIME  = "PART_TIME",
    CONTRACT   = "CONTRACT",
    INTERN     = "INTERN",
    CONSULTANT = "CONSULTANT",
}

export enum Gender {
    MALE   = "MALE",
    FEMALE = "FEMALE",
    OTHER  = "OTHER",
}

export enum BloodGroup {
    A_POS  = "A+",
    A_NEG  = "A-",
    B_POS  = "B+",
    B_NEG  = "B-",
    O_POS  = "O+",
    O_NEG  = "O-",
    AB_POS = "AB+",
    AB_NEG = "AB-",
}

export enum MaritalStatus {
    SINGLE   = "SINGLE",
    MARRIED  = "MARRIED",
    DIVORCED = "DIVORCED",
    WIDOWED  = "WIDOWED",
}

// EMBEDDED INTERFACES

export interface EmergencyContact {
  name:         string;
  relationship: string;
  phone:        string;
  email?:       string;
}

export interface EmployeeAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?:         string;
  state?:        string;
  countryCode?:  string;
  zip?:          string;
}

// EMPLOYEE DOCUMENT INTERFACE

export interface EmployeeDocument extends BaseDocument {
  // Auto-generated
  employeeCode: string;       // EMP-0001, EMP-0002 — unique per tenant

  // Identity
  firstName:     string;
  lastName:      string;
  email:         string;
  phone?:        string;
  dateOfBirth?:  Date;
  gender?:       Gender;
  bloodGroup?:   BloodGroup;
  maritalStatus?: MaritalStatus;
  nationality?:  string;
  pan?:          string;      // encrypted at write, masked on read
  aadhaar?:      string;      // encrypted at write, masked on read
  passportNo?:   string;

  // Organisation
  departmentId:  mongoose.Types.ObjectId;
  designationId: mongoose.Types.ObjectId;
  managerId?:    mongoose.Types.ObjectId;   // reports to
  employeeType:  EmployeeType;
  status:        EmployeeStatus;
  joiningDate:   Date;
  confirmationDate?: Date;
  probationEndDate?: Date;
  exitDate?:     Date;
  exitReason?:   string;
  shiftId? :           mongoose.Types.ObjectId;  // fixed shift (overridden by rotationPlanId)
  rotationPlanId?:     mongoose.Types.ObjectId;  // active rotation plan
  rotationStartDate?:  Date;                     // when slot-1 of the plan began

  // Address — embedded
  currentAddress?:   EmployeeAddress;
  permanentAddress?: EmployeeAddress;

  // Emergency contact — embedded
  emergencyContacts: EmergencyContact[];

  // Avatar
  avatarUrl?: string;

  // Profile completion tracking — step sequence
  onboardingStep:             number;  // 1-5, which step they're currently on
  onboardingComplete:         boolean; // true once step 5 is submitted
  onboardingStepsCompleted: {
    personalDetails: boolean;
    familyDetails:   boolean;
    bankDetails:     boolean;
    documents:       boolean;
    reviewed:        boolean;
  };

  // Legacy profile-completion fields (used by service & middleware)
  isProfileComplete: boolean;
  profileCompletion: {
    personalDetails:  boolean;
    address:          boolean;
    emergencyContact: boolean;
    bankDetails:      boolean;
    mandatoryDocs:    boolean;
  };

  isActive: boolean;
}


const AddressSchema = {
  addressLine1: { type: String, trim: true },
  addressLine2: { type: String, trim: true },
  city:         { type: String, trim: true },
  state:        { type: String, trim: true },
  countryCode:  { type: String, trim: true, uppercase: true },
  zip:          { type: String, trim: true },
};

const EmergencyContactSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone:        { type: String, required: true, trim: true },
    email:        { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const EmployeeSchema = createBaseSchema<EmployeeDocument>(
  {
    employeeCode: {
      type:     String,
      required: true,
      trim:     true,
      uppercase: true,
    },

    // Identity
    firstName: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },
    lastName: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 100,
    },
    email: {
      type:      String,
      required:  true,
      lowercase: true,
      trim:      true,
    },
    phone:        { type: String, trim: true },
    dateOfBirth:  { type: Date },
    gender: {
      type: String,
      enum: Object.values(Gender),
    },
    bloodGroup: {
      type: String,
      enum: Object.values(BloodGroup),
    },
    maritalStatus: {
      type: String,
      enum: Object.values(MaritalStatus),
    },
    nationality: { type: String, trim: true },
    pan:         { type: String, trim: true, uppercase: true },
    aadhaar:     { type: String, trim: true },
    passportNo:  { type: String, trim: true },

    // Organisation
    departmentId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Department",
      required: true,
      index:    true,
    },
    designationId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Designation",
      required: true,
      index:    true,
    },
    managerId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Employee",
      default: null,
    },
    shiftId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Shift",
      default: null,   // null = use tenant's default shift
    },
    rotationPlanId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "ShiftRotationPlan",
      default: null,   // null = not on a rotation plan
    },
    rotationStartDate: {
      type:    Date,
      default: null,   // date when slot-1 of the plan started for this employee
    },
    employeeType: {
      type:    String,
      enum:    Object.values(EmployeeType),
      default: EmployeeType.FULL_TIME,
    },
    status: {
      type:    String,
      enum:    Object.values(EmployeeStatus),
      default: EmployeeStatus.ACTIVE,
    },
    joiningDate: {
      type:     Date,
      required: true,
    },
    confirmationDate: { type: Date },
    probationEndDate: { type: Date },
    exitDate:         { type: Date },
    exitReason:       { type: String, trim: true },

    // Address
    currentAddress:   { type: AddressSchema },
    permanentAddress: { type: AddressSchema },

    // Emergency contacts
    emergencyContacts: {
      type:    [EmergencyContactSchema],
      default: [],
    },

    avatarUrl: { type: String },

    isActive: {
      type:    Boolean,
      default: true,
    },

    // Profile completion tracking — step sequence
    onboardingStep: {
      type:    Number,
      default: 1,
      min: 1, max: 5,
    },
    onboardingComplete: {
      type:    Boolean,
      default: false,
    },
    onboardingStepsCompleted: {
      personalDetails: { type: Boolean, default: false },
      familyDetails:   { type: Boolean, default: false },
      bankDetails:     { type: Boolean, default: false },
      documents:       { type: Boolean, default: false },
      reviewed:        { type: Boolean, default: false },
    },

    // Legacy profile-completion fields (used by service & middleware)
    isProfileComplete: {
      type:    Boolean,
      default: false,
    },
    profileCompletion: {
      personalDetails:  { type: Boolean, default: false },
      address:          { type: Boolean, default: false },
      emergencyContact: { type: Boolean, default: false },
      bankDetails:      { type: Boolean, default: false },
      mandatoryDocs:    { type: Boolean, default: false },
    },
  },
  { collection: "employees" }
);


//Indexes
EmployeeSchema.index({ tenantId: 1, employeeCode: 1 }, { unique: true });
EmployeeSchema.index({ tenantId: 1, email: 1 },        { unique: true });
EmployeeSchema.index({ tenantId: 1, branchId: 1 });
EmployeeSchema.index({ tenantId: 1, departmentId: 1 });
EmployeeSchema.index({ tenantId: 1, designationId: 1 });
EmployeeSchema.index({ tenantId: 1, status: 1 });
EmployeeSchema.index({ tenantId: 1, isActive: 1 });
EmployeeSchema.index({ tenantId: 1, managerId: 1 });

export const EmployeeModel = mongoose.model<EmployeeDocument>(
  "Employee",
  EmployeeSchema
);