import { z } from "zod";
import {
  safeStringSchema,
  objectIdSchema,
  emailSchema,
  anyEmailSchema,
  phoneSchema,
  panSchema,
  aadhaarSchema,
  passportSchema,
  drivingLicenseSchema,
  voterIdSchema,
  dateSchema,
  countryCodeSchema,
  withPhoneValidation,
} from "../../../shared/validators/common.validator";



//Create Employee
export const CreateEmployeeDto = withPhoneValidation(
  z.object({
    // Identity
    firstName: safeStringSchema(2, 100),
    lastName: safeStringSchema(2, 100),
    email: anyEmailSchema.optional(),
    workEmail: anyEmailSchema.optional(),
    phone: phoneSchema.optional(),
    countryCode: countryCodeSchema.optional().default("IN"),
    pfOnActuals: z.boolean().optional().default(false),
    dateOfBirth: dateSchema.optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
    maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
    nationality: safeStringSchema(2, 100).optional(),
    pan: panSchema.optional(),
    aadhaar: aadhaarSchema.optional(),
    passportNo: passportSchema.optional(),
    drivingLicense: drivingLicenseSchema.optional(),
    voterId: voterIdSchema.optional(),
    // Organisation
    branchId: z.preprocess(
      (val) => (val === "" ? undefined : val),
      objectIdSchema.optional()
    ),
    departmentId: objectIdSchema,
    designationId: objectIdSchema,
    managerId: objectIdSchema.optional(),
    employeeType: z.enum([
      "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT"
    ]).optional().default("FULL_TIME"),
    employmentType: z.enum([
      "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT"
    ]).optional(),
    joiningDate: dateSchema.optional(),
    dateOfJoining: dateSchema.optional(),
    probationEndDate: dateSchema.optional(),
    shiftId: objectIdSchema.optional(),

    // Address
    currentAddress: z.object({
      addressLine1: safeStringSchema(1, 200).optional(),
      addressLine2: safeStringSchema(1, 200).optional(),
      city: safeStringSchema(1, 100).optional(),
      state: safeStringSchema(1, 100).optional(),
      countryCode: z.string().length(2).toUpperCase().optional(),
      zip: z.string().trim().optional(),
    }).optional(),

    permanentAddress: z.object({
      addressLine1: safeStringSchema(1, 200).optional(),
      addressLine2: safeStringSchema(1, 200).optional(),
      city: safeStringSchema(1, 100).optional(),
      state: safeStringSchema(1, 100).optional(),
      countryCode: z.string().length(2).toUpperCase().optional(),
      zip: z.string().trim().optional(),
    }).optional(),

    // Emergency contacts
    emergencyContacts: z.array(
      z.object({
        name: safeStringSchema(2, 100),
        relationship: safeStringSchema(2, 50),
        phone: phoneSchema,
        email: anyEmailSchema.optional(),
      })
    ).optional().default([]),

    // Salary structure (optional on onboarding)
    salaryStructure: z.object({
      ctcAnnual: z.number().min(0),
      lineItems: z.array(z.object({
        componentCode: z.string().trim().toUpperCase(),
        amount: z.number().min(0),
      })).min(1),
    }).optional(),

    // Optional bank account
    bankAccount: z.object({
      bankName: z.string().trim().min(2),
      accountNumber: z.string().trim().min(8).max(20),
      ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
      accountType: z.enum(["SAVINGS", "CURRENT", "SALARY"]).optional().default("SALARY"),
    }).optional(),
  })
).transform((data) => ({
  ...data,
  email: (data.email || data.workEmail || "").trim(),
  countryCode: data.countryCode || "IN",
  joiningDate: data.joiningDate || data.dateOfJoining || new Date().toISOString().split("T")[0],
  employeeType: data.employeeType || data.employmentType || "FULL_TIME",
})).refine((data) => !!data.email && data.email.includes("@"), {
  message: "Work email (or email) is required",
  path: ["email"],
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeDto>;


//Update Employee
export const UpdateEmployeeDto = withPhoneValidation(z.object({
  firstName: safeStringSchema(2, 100).optional(),
  lastName: safeStringSchema(2, 100).optional(),
  phone: phoneSchema.optional(),
  countryCode: countryCodeSchema.optional(),
  pfOnActuals: z.boolean().optional(),
  dateOfBirth: dateSchema.optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  nationality: safeStringSchema(2, 100).optional(),
  pan: panSchema.optional(),
  aadhaar: aadhaarSchema.optional(),
  passportNo: passportSchema.optional(),
  drivingLicense: drivingLicenseSchema.optional(),
  voterId: voterIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  designationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  managerId: objectIdSchema.optional(),
  employeeType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT"]).optional(),
  confirmationDate: dateSchema.optional(),
  probationEndDate: dateSchema.optional(),
  currentAddress: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city: safeStringSchema(1, 100).optional(),
    state: safeStringSchema(1, 100).optional(),
    countryCode: z.string().length(2).toUpperCase().optional(),
    zip: z.string().trim().optional(),
  }).optional(),
  permanentAddress: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city: safeStringSchema(1, 100).optional(),
    state: safeStringSchema(1, 100).optional(),
    countryCode: z.string().length(2).toUpperCase().optional(),
    zip: z.string().trim().optional(),
  }).optional(),
  emergencyContacts: z.array(
    z.object({
      name: safeStringSchema(2, 100),
      relationship: safeStringSchema(2, 50),
      phone: phoneSchema,
      email: emailSchema.optional(),
    })
  ).optional(),
  avatarUrl: z.string().url().optional(),
}));

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeDto>;

//Update Status
export const UpdateEmployeeStatusDto = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"]),
  exitDate: dateSchema.optional(),
  exitReason: safeStringSchema(2, 500).optional(),
});

export type UpdateEmployeeStatusInput = z.infer<typeof UpdateEmployeeStatusDto>;

//Add Bank Account
export const AddBankAccountDto = z.object({
  bankName: safeStringSchema(2, 200),
  accountHolderName: safeStringSchema(2, 200).optional(),
  accountNumber: z.string().trim().min(8).max(20),
  ifscCode: z.string().trim().toUpperCase().optional(),
  ifsc: z.string().trim().toUpperCase().optional(),
  accountType: z.enum(["SAVINGS", "CURRENT", "SALARY"]).optional().default("SALARY"),
  isPrimary: z.boolean().optional().default(false),
}).transform((data) => ({
  ...data,
  ifscCode: (data.ifscCode || data.ifsc || "").toUpperCase(),
})).refine((data) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode), {
  message: "Invalid IFSC code format (e.g. HDFC0000123)",
  path: ["ifscCode"],
});

export type AddBankAccountInput = z.infer<typeof AddBankAccountDto>;



//List Employees Query
export const ListEmployeesQueryDto = z.object({
  pageNumber: z.string().optional().transform(v => v ? parseInt(v) : 1),
  pageSize: z.string().optional().transform(v => v ? parseInt(v) : 10),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"]).optional(),
  departmentId: objectIdSchema.optional(),
  designationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  search: z.string().trim().optional(),
  joiningPeriod: z.enum(["this_month", "last_3_months", "last_6_months", "last_year"]).optional(),
});

export type ListEmployeesQuery = z.infer<typeof ListEmployeesQueryDto>;

// Eligible Managers Query for dynamic department/branch assignment
export const EligibleManagersQueryDto = z.object({
  branchId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  designationId: objectIdSchema.optional(),
  minLevel: z.string().optional().transform(v => (v ? parseInt(v, 10) : undefined)),
  excludeEmployeeId: objectIdSchema.optional(),
  search: z.string().trim().optional(),
});
export type EligibleManagersQuery = z.infer<typeof EligibleManagersQueryDto>;


// Calendar events query
export const CalendarEventsQueryDto = z.object({
  period: z.enum(["TODAY", "THIS_WEEK", "THIS_MONTH", "PAST_WEEK", "PAST_MONTH"]),
  branchId: objectIdSchema.optional(),
});
export type CalendarEventsQuery = z.infer<typeof CalendarEventsQueryDto>;

export interface CalendarEvent {
  type: "BIRTHDAY" | "ANNIVERSARY";
  title: string;
  date: Date;
  employeeId: string;
  employeeCode: string;
  branchId?: string;
  years?: number;
}

export const CropAvatarDto = z.object({
  cropX: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  cropY: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  cropWidth: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  cropHeight: z.string().optional().transform(v => v ? parseInt(v) : undefined),
});
export type CropAvatarInput = z.infer<typeof CropAvatarDto>;
