import mongoose from "mongoose";
import {
  createBaseSchema,
  BaseDocument,
} from "../../../shared/database/base.schema";

export interface GLAccountMapping {
  accountCode: string;
  accountName: string;
}

export interface PayrollGLConfigDocument extends BaseDocument {
  // Debit Expense Accounts
  grossSalaryExpenseAccount: GLAccountMapping;
  employerPfExpenseAccount: GLAccountMapping;
  employerEsiExpenseAccount: GLAccountMapping;
  gratuityExpenseAccount: GLAccountMapping;
  bonusExpenseAccount: GLAccountMapping;

  // Credit Liability & Clearing Accounts
  pfPayableAccount: GLAccountMapping;
  esiPayableAccount: GLAccountMapping;
  ptPayableAccount: GLAccountMapping;
  lwfPayableAccount: GLAccountMapping;
  tdsPayableAccount: GLAccountMapping;
  salariesPayableAccount: GLAccountMapping;
}

const GLAccountMappingSchema = new mongoose.Schema(
  {
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const PayrollGLConfigSchema = createBaseSchema<PayrollGLConfigDocument>(
  {
    grossSalaryExpenseAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "5001", accountName: "Salaries and Wages Expense" },
    },
    employerPfExpenseAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "5002", accountName: "Employer PF Contribution Expense" },
    },
    employerEsiExpenseAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "5003", accountName: "Employer ESI Contribution Expense" },
    },
    gratuityExpenseAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "5004", accountName: "Gratuity Provision Expense" },
    },
    bonusExpenseAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "5005", accountName: "Bonus and Incentives Expense" },
    },

    pfPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2001", accountName: "Provident Fund Payable" },
    },
    esiPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2002", accountName: "ESI Contribution Payable" },
    },
    ptPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2003", accountName: "Professional Tax Payable" },
    },
    lwfPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2004", accountName: "Labour Welfare Fund Payable" },
    },
    tdsPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2005", accountName: "TDS on Salary Payable" },
    },
    salariesPayableAccount: {
      type: GLAccountMappingSchema,
      default: { accountCode: "2010", accountName: "Net Salaries Payable / Bank Clearing" },
    },
  },
  { collection: "payroll_gl_configs" }
);

PayrollGLConfigSchema.index({ tenantId: 1 }, { unique: true });

export const PayrollGLConfigModel = mongoose.model<PayrollGLConfigDocument>(
  "PayrollGLConfig",
  PayrollGLConfigSchema
);
