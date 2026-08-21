import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export type BankFieldSource =
  | "ACCOUNT_NUMBER"
  | "NET_AMOUNT"
  | "BENEFICIARY_NAME"
  | "IFSC_CODE"
  | "REMARKS"
  | "EMAIL"
  | "EMPLOYEE_CODE"
  | "BANK_NAME"
  | "BRANCH_NAME"
  | "PAYMENT_DATE"
  | "STATIC_VALUE";

export interface BankColumnMapping {
  headerName: string;
  fieldSource: BankFieldSource;
  staticValue?: string;        // e.g. "SALARY", "NEFT", "D", "01"
  format?: "2_DECIMALS" | "NO_DECIMALS" | "YYYYMMDD" | "DD/MM/YYYY" | "RAW";
  fixedWidth?: number;         // for fixed-width text formats
  defaultValue?: string;
}

export interface DynamicBankPayoutConfig {
  bankCode: string;            // e.g. "KOTAK", "YES_BANK", "ICICI", "AXIS", "HDFC", "SBI", "CITI", "PNB", "ANY_BANK"
  bankName: string;            // e.g. "Kotak Mahindra Corporate Payout"
  delimiter: string;           // ",", "|", "\t", "~", "#", "^"
  fileExtension: "csv" | "txt" | "tsv";
  mimeType: "text/csv" | "text/plain" | "text/tab-separated-values";
  includeHeader: boolean;
  quoteStrings: boolean;
  columns: BankColumnMapping[];
}

export interface BankPayoutConfigDocument extends OrgLevelDocument {
  name: string;
  bankCode: string;            // e.g. "KOTAK", "YES_BANK", "ICICI", "AXIS", "HDFC", "SBI", "CITI", "PNB", "ANY_BANK"
  bankName: string;            // e.g. "Kotak Mahindra Corporate Payout"
  branchId?: mongoose.Types.ObjectId; // Branch-specific override
  delimiter: string;           // ",", "|", "\t", "~", "#", "^"
  fileExtension: "csv" | "txt" | "tsv";
  mimeType: "text/csv" | "text/plain" | "text/tab-separated-values";
  includeHeader: boolean;
  quoteStrings: boolean;
  columns: BankColumnMapping[];
  isActive: boolean;
}

const BankColumnMappingSchema = new mongoose.Schema(
  {
    headerName: { type: String, required: true, trim: true },
    fieldSource: {
      type: String,
      required: true,
      enum: [
        "ACCOUNT_NUMBER",
        "NET_AMOUNT",
        "BENEFICIARY_NAME",
        "IFSC_CODE",
        "REMARKS",
        "EMAIL",
        "EMPLOYEE_CODE",
        "BANK_NAME",
        "BRANCH_NAME",
        "PAYMENT_DATE",
        "STATIC_VALUE",
      ],
    },
    staticValue: { type: String, default: "" },
    format: {
      type: String,
      enum: ["2_DECIMALS", "NO_DECIMALS", "YYYYMMDD", "DD/MM/YYYY", "RAW"],
      default: "RAW",
    },
    fixedWidth: { type: Number },
    defaultValue: { type: String, default: "" },
  },
  { _id: false }
);

const BankPayoutConfigSchema = createOrgLevelSchema<BankPayoutConfigDocument>(
  {
    name: { type: String, required: true, trim: true },
    bankCode: { type: String, required: true, uppercase: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    delimiter: { type: String, default: "," },
    fileExtension: {
      type: String,
      enum: ["csv", "txt", "tsv"],
      default: "csv",
    },
    mimeType: {
      type: String,
      enum: ["text/csv", "text/plain", "text/tab-separated-values"],
      default: "text/csv",
    },
    includeHeader: { type: Boolean, default: true },
    quoteStrings: { type: Boolean, default: false },
    columns: { type: [BankColumnMappingSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { collection: "bank_payout_configs" }
);

BankPayoutConfigSchema.index({ tenantId: 1, bankCode: 1, branchId: 1 });
BankPayoutConfigSchema.index({ tenantId: 1, isActive: 1 });

export const BankPayoutConfigModel = mongoose.model<BankPayoutConfigDocument>(
  "BankPayoutConfig",
  BankPayoutConfigSchema
);
