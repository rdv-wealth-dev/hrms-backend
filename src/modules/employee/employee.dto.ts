import { z } from "zod";
import {
  safeStringSchema,
  objectIdSchema,
  emailSchema,
  phoneSchema,
  panSchema,
  dateSchema,
  countryCodeSchema,
  withPhoneValidation,
} from "../../core/validators/common.validator";

//Create Employee
export const CreateEmployeeDto = withPhoneValidation(z.object({
  // Identity
  firstName:     safeStringSchema(2, 100),
  lastName:      safeStringSchema(2, 100),
  email:         emailSchema,
  phone:         phoneSchema.optional(),
  countryCode:   countryCodeSchema,
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

  // Optional — attach salary structure in the same onboarding call
  salaryStructure: z.object({
    ctcAnnual: z.number().min(0),
    lineItems: z.array(z.object({
      componentCode: z.string().trim().toUpperCase(),
      amount:        z.number().min(0),
    })).min(1),
  }).optional(),

  // Optional — attach a bank account in the same onboarding call
  bankAccount: z.object({
    bankName:      z.string().trim().min(2),
    accountNumber: z.string().trim().min(8).max(20),
    ifscCode:      z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    accountType:   z.enum(["SAVINGS","CURRENT","SALARY"]).optional().default("SALARY"),
  }).optional(),
}));

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeDto>;

//Update Employee
export const UpdateEmployeeDto = withPhoneValidation(z.object({
  firstName:        safeStringSchema(2, 100).optional(),
  lastName:         safeStringSchema(2, 100).optional(),
  phone:            phoneSchema.optional(),
  countryCode:      countryCodeSchema.optional(),
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
}));

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

export const RequestUploadUrlDto = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  documentType: z.enum([
    "PAN","AADHAAR","PASSPORT","DRIVING_LICENSE",
    "OFFER_LETTER","RESUME","DEGREE","EXPERIENCE","OTHER"
  ]),
});

export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlDto>;

export const VerifyDocumentDto = z.object({
  isVerified: z.boolean(),
  remarks:    z.string().trim().max(500).optional(),
});
export type VerifyDocumentInput = z.infer<typeof VerifyDocumentDto>;