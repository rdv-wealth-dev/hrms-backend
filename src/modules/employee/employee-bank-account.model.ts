import mongoose from "mongoose";
import { createBaseSchema, BaseDocument } from "../../core/database/base.schema"

export interface EmployeeBankAccountDocument extends BaseDocument {
  employeeId:    mongoose.Types.ObjectId;
  bankName:      string;
  accountNumber: string;   // stored masked — last 4 digits only visible
  ifscCode:      string;
  accountType:   string;
  isPrimary:     boolean;
  isActive:      boolean;
}

const BankAccountSchema = createBaseSchema<EmployeeBankAccountDocument>(
  {
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    bankName: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    accountNumber: {
      // Store full number but return masked — XXXXXX1234
      type:     String,
      required: true,
      trim:     true,
    },
    ifscCode: {
      type:      String,
      required:  true,
      trim:      true,
      uppercase: true,
    },
    accountType: {
      type:    String,
      enum:    ["SAVINGS", "CURRENT", "SALARY"],
      default: "SALARY",
    },
    isPrimary: {
      type:    Boolean,
      default: false,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { collection: "employee_bank_accounts" }
);

BankAccountSchema.index({ tenantId: 1, employeeId: 1 });
BankAccountSchema.index({ tenantId: 1, employeeId: 1, isPrimary: 1 });

export const EmployeeBankAccountModel =
  mongoose.model<EmployeeBankAccountDocument>(
    "EmployeeBankAccount",
    BankAccountSchema
  );