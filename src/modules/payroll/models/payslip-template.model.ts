import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../../shared/database/base.schema";

export interface PayslipSectionsConfig {
  showCompanyLogo: boolean;
  showCompanyCin: boolean;
  showEmployeePhoto: boolean;
  showDepartmentDesignation: boolean;
  showPanUan: boolean;
  showBankDetails: boolean;
  showAttendanceSummary: boolean;
  showLeaveBalances: boolean;
  showYtdTaxSummary: boolean;
  showEmployerContributions: boolean;
  showNetPayInWords: boolean;
  showDigitalSignatureBox: boolean;
}

export interface PayslipTemplateDocument extends OrgLevelDocument {
  name: string;
  templateCode: string;
  layoutType: "STANDARD" | "COMPACT" | "MODERN_GRID" | "EXECUTIVE" | "CUSTOM_HTML";
  isCompanyDefault: boolean;
  sections: PayslipSectionsConfig;
  customDisclaimerText?: string;
  headerColorHex?: string;
  accentColorHex?: string;
  customCss?: string;
  htmlTemplate?: string;
  isActive: boolean;
}

const PayslipSectionsSchema = new mongoose.Schema(
  {
    showCompanyLogo: { type: Boolean, default: true },
    showCompanyCin: { type: Boolean, default: true },
    showEmployeePhoto: { type: Boolean, default: false },
    showDepartmentDesignation: { type: Boolean, default: true },
    showPanUan: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: true },
    showAttendanceSummary: { type: Boolean, default: true },
    showLeaveBalances: { type: Boolean, default: true },
    showYtdTaxSummary: { type: Boolean, default: true },
    showEmployerContributions: { type: Boolean, default: true },
    showNetPayInWords: { type: Boolean, default: true },
    showDigitalSignatureBox: { type: Boolean, default: true },
  },
  { _id: false }
);

const PayslipTemplateSchema = createOrgLevelSchema<PayslipTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    templateCode: { type: String, required: true, uppercase: true, trim: true },
    layoutType: {
      type: String,
      enum: ["STANDARD", "COMPACT", "MODERN_GRID", "EXECUTIVE", "CUSTOM_HTML"],
      default: "STANDARD",
    },
    isCompanyDefault: { type: Boolean, default: false },
    sections: {
      type: PayslipSectionsSchema,
      default: () => ({
        showCompanyLogo: true,
        showCompanyCin: true,
        showEmployeePhoto: false,
        showDepartmentDesignation: true,
        showPanUan: true,
        showBankDetails: true,
        showAttendanceSummary: true,
        showLeaveBalances: true,
        showYtdTaxSummary: true,
        showEmployerContributions: true,
        showNetPayInWords: true,
        showDigitalSignatureBox: true,
      }),
    },
    customDisclaimerText: {
      type: String,
      default: "This is a computer generated payslip and does not require a physical signature.",
    },
    headerColorHex: { type: String, default: "#1e3a8a" },
    accentColorHex: { type: String, default: "#3b82f6" },
    customCss: { type: String },
    htmlTemplate: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { collection: "payslip_templates" }
);

PayslipTemplateSchema.index({ tenantId: 1, templateCode: 1 }, { unique: true });
PayslipTemplateSchema.index({ tenantId: 1, isCompanyDefault: 1 });

export const PayslipTemplateModel = mongoose.model<PayslipTemplateDocument>(
  "PayslipTemplate",
  PayslipTemplateSchema
);
