import { z } from "zod";
import {
  safeStringSchema,
  objectIdSchema,
  emailSchema,
  phoneSchema,
  panSchema,
  dateSchema,
} from "../../core/validators/common.validator";

//Create Employee
export const CreateEmployeeDto = z.object({
  // Identity
  firstName:     safeStringSchema(2, 100),
  lastName:      safeStringSchema(2, 100),
  email:         emailSchema,
  phone:         phoneSchema.optional(),
  dateOfBirth:   dateSchema.optional(),
  gender:        z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup:    z.enum(["A+","A-","B+","B-","O+","O-","AB+","AB-"]).optional(),
  maritalStatus: z.enum(["SINGLE","MARRIED","DIVORCED","WIDOWED"]).optional(),
  nationality:   safeStringSchema(2, 100).optional(),
  pan:           panSchema.optional(),
  aadhaar:       z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits").optional(),
  passportNo:    z.string().trim().optional(),

  // Organisation
  branchId:      objectIdSchema,
  departmentId:  objectIdSchema,
  designationId: objectIdSchema,
  managerId:     objectIdSchema.optional(),
  employeeType:  z.enum([
    "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT"
  ]).default("FULL_TIME"),
  joiningDate:   dateSchema,
  probationEndDate: dateSchema.optional(),

  // Address
  currentAddress: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  z.string().length(2).toUpperCase().optional(),
    zip:          z.string().trim().optional(),
  }).optional(),

  permanentAddress: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  z.string().length(2).toUpperCase().optional(),
    zip:          z.string().trim().optional(),
  }).optional(),

  // Emergency contacts
  emergencyContacts: z.array(
    z.object({
      name:         safeStringSchema(2, 100),
      relationship: safeStringSchema(2, 50),
      phone:        phoneSchema,
      email:        emailSchema.optional(),
    })
  ).optional().default([]),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeDto>;

//Update Employee
export const UpdateEmployeeDto = z.object({
  firstName:        safeStringSchema(2, 100).optional(),
  lastName:         safeStringSchema(2, 100).optional(),
  phone:            phoneSchema.optional(),
  dateOfBirth:      dateSchema.optional(),
  gender:           z.enum(["MALE","FEMALE","OTHER"]).optional(),
  bloodGroup:       z.enum(["A+","A-","B+","B-","O+","O-","AB+","AB-"]).optional(),
  maritalStatus:    z.enum(["SINGLE","MARRIED","DIVORCED","WIDOWED"]).optional(),
  nationality:      safeStringSchema(2, 100).optional(),
  pan:              panSchema.optional(),
  aadhaar:          z.string().regex(/^\d{12}$/).optional(),
  passportNo:       z.string().trim().optional(),
  departmentId:     objectIdSchema.optional(),
  designationId:    objectIdSchema.optional(),
  managerId:        objectIdSchema.optional(),
  employeeType:     z.enum(["FULL_TIME","PART_TIME","CONTRACT","INTERN","CONSULTANT"]).optional(),
  confirmationDate: dateSchema.optional(),
  probationEndDate: dateSchema.optional(),
  currentAddress:   z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  z.string().length(2).toUpperCase().optional(),
    zip:          z.string().trim().optional(),
  }).optional(),
  permanentAddress: z.object({
    addressLine1: safeStringSchema(1, 200).optional(),
    addressLine2: safeStringSchema(1, 200).optional(),
    city:         safeStringSchema(1, 100).optional(),
    state:        safeStringSchema(1, 100).optional(),
    countryCode:  z.string().length(2).toUpperCase().optional(),
    zip:          z.string().trim().optional(),
  }).optional(),
  emergencyContacts: z.array(
    z.object({
      name:         safeStringSchema(2, 100),
      relationship: safeStringSchema(2, 50),
      phone:        phoneSchema,
      email:        emailSchema.optional(),
    })
  ).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeDto>;

//Update Status
export const UpdateEmployeeStatusDto = z.object({
  status:     z.enum(["ACTIVE","INACTIVE","ON_LEAVE","TERMINATED","RESIGNED"]),
  exitDate:   dateSchema.optional(),
  exitReason: safeStringSchema(2, 500).optional(),
});

export type UpdateEmployeeStatusInput = z.infer<typeof UpdateEmployeeStatusDto>;

//Add Bank Account
export const AddBankAccountDto = z.object({
  bankName:      safeStringSchema(2, 200),
  accountNumber: z.string().trim().min(8).max(20),
  ifscCode:      z.string().trim().toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
  accountType:   z.enum(["SAVINGS","CURRENT","SALARY"]).default("SALARY"),
  isPrimary:     z.boolean().default(false),
});

export type AddBankAccountInput = z.infer<typeof AddBankAccountDto>;

//Add Document
export const AddDocumentDto = z.object({
  documentType: z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ]),
  fileName:   safeStringSchema(1, 255),
  s3Key:      safeStringSchema(1, 500),
  mimeType:   safeStringSchema(1, 100),
  sizeBytes:  z.number().min(0).default(0),
  expiryDate: dateSchema.optional(),
});

export type AddDocumentInput = z.infer<typeof AddDocumentDto>;

//List Employees Query
export const ListEmployeesQueryDto = z.object({
  pageNumber:    z.string().optional().transform(v => v ? parseInt(v) : 1),
  pageSize:      z.string().optional().transform(v => v ? parseInt(v) : 10),
  status:        z.enum(["ACTIVE","INACTIVE","ON_LEAVE","TERMINATED","RESIGNED"]).optional(),
  departmentId:  objectIdSchema.optional(),
  designationId: objectIdSchema.optional(),
  branchId:      objectIdSchema.optional(),
  search:        z.string().trim().optional(),
});

export type ListEmployeesQuery = z.infer<typeof ListEmployeesQueryDto>;