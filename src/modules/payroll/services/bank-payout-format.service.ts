import ExcelJS from "exceljs";
import { PayslipDocument } from "../models/payslip.model";
import { PayrollRunDocument } from "../models/payroll-run.model";
import { BankFieldSource, BankColumnMapping, DynamicBankPayoutConfig } from "../models/bank-payout-config.model";

export { BankFieldSource, BankColumnMapping, DynamicBankPayoutConfig };

export interface BankDisbursementRecord {
  accountNumber: string;
  amount: number;
  beneficiaryName: string;
  ifscCode: string;
  remarks: string;
  email?: string;
  employeeCode?: string;
  bankName?: string;
  branchName?: string;
  paymentDate?: string;
}

export class BankPayoutFormatService {
  private static registeredFormats: Map<string, DynamicBankPayoutConfig> = new Map();

  static {
    // Standard default presets as fallback templates
    this.registerFormat({
      bankCode: "ICICI",
      bankName: "ICICI Bank Corporate Direct Credit",
      delimiter: ",",
      fileExtension: "csv",
      mimeType: "text/csv",
      includeHeader: true,
      quoteStrings: false,
      columns: [
        { headerName: "Account No", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Beneficiary Name", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "IFSC Code", fieldSource: "IFSC_CODE" },
        { headerName: "Remarks", fieldSource: "REMARKS" },
      ],
    });

    this.registerFormat({
      bankCode: "AXIS",
      bankName: "Axis Bank Direct Salary Disbursement",
      delimiter: "|",
      fileExtension: "txt",
      mimeType: "text/plain",
      includeHeader: false,
      quoteStrings: false,
      columns: [
        { headerName: "Trans Type", fieldSource: "STATIC_VALUE", staticValue: "P" },
        { headerName: "Account No", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Narration", fieldSource: "REMARKS" },
        { headerName: "Beneficiary", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "IFSC", fieldSource: "IFSC_CODE" },
      ],
    });

    this.registerFormat({
      bankCode: "HDFC",
      bankName: "HDFC Bank Direct Deposit / E-Net",
      delimiter: ",",
      fileExtension: "csv",
      mimeType: "text/csv",
      includeHeader: false,
      quoteStrings: false,
      columns: [
        { headerName: "RecordType", fieldSource: "STATIC_VALUE", staticValue: "D" },
        { headerName: "Account Number", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Beneficiary Name", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "IFSC Code", fieldSource: "IFSC_CODE" },
        { headerName: "Remarks", fieldSource: "REMARKS" },
      ],
    });

    this.registerFormat({
      bankCode: "SBI",
      bankName: "SBI Corporate Direct Credit",
      delimiter: ",",
      fileExtension: "csv",
      mimeType: "text/csv",
      includeHeader: true,
      quoteStrings: true,
      columns: [
        { headerName: "Beneficiary Code", fieldSource: "EMPLOYEE_CODE" },
        { headerName: "Beneficiary Name", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "Account Number", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "IFSC", fieldSource: "IFSC_CODE" },
        { headerName: "Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Narration", fieldSource: "REMARKS" },
      ],
    });

    this.registerFormat({
      bankCode: "KOTAK",
      bankName: "Kotak Mahindra CMS Format",
      delimiter: ",",
      fileExtension: "csv",
      mimeType: "text/csv",
      includeHeader: true,
      quoteStrings: false,
      columns: [
        { headerName: "Client Code", fieldSource: "STATIC_VALUE", staticValue: "CMS01" },
        { headerName: "Product Code", fieldSource: "STATIC_VALUE", staticValue: "SALARY" },
        { headerName: "Payment Date", fieldSource: "PAYMENT_DATE", format: "DD/MM/YYYY" },
        { headerName: "Dr Ac No", fieldSource: "STATIC_VALUE", staticValue: "" },
        { headerName: "Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Beneficiary Name", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "Beneficiary Ac No", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "IFSC Code", fieldSource: "IFSC_CODE" },
      ],
    });

    this.registerFormat({
      bankCode: "STANDARD_CSV",
      bankName: "Standard Multi-Bank CSV (Universal)",
      delimiter: ",",
      fileExtension: "csv",
      mimeType: "text/csv",
      includeHeader: true,
      quoteStrings: true,
      columns: [
        { headerName: "Employee Code", fieldSource: "EMPLOYEE_CODE" },
        { headerName: "Beneficiary Name", fieldSource: "BENEFICIARY_NAME" },
        { headerName: "Bank Name", fieldSource: "BANK_NAME" },
        { headerName: "Account Number", fieldSource: "ACCOUNT_NUMBER" },
        { headerName: "IFSC Code", fieldSource: "IFSC_CODE" },
        { headerName: "Net Amount", fieldSource: "NET_AMOUNT", format: "2_DECIMALS" },
        { headerName: "Payment Date", fieldSource: "PAYMENT_DATE", format: "YYYYMMDD" },
        { headerName: "Remarks", fieldSource: "REMARKS" },
      ],
    });
  }

  public static registerFormat(config: DynamicBankPayoutConfig): void {
    this.registeredFormats.set(config.bankCode.toUpperCase(), config);
  }

  public static getAvailableFormats(): DynamicBankPayoutConfig[] {
    return Array.from(this.registeredFormats.values());
  }

  public static formatBankExport(
    records: BankDisbursementRecord[],
    formatConfigOrBankCode: DynamicBankPayoutConfig | string
  ): { fileContent: string; mimeType: string; filename: string } {
    let config: DynamicBankPayoutConfig | undefined;

    if (typeof formatConfigOrBankCode === "string") {
      config = this.registeredFormats.get(formatConfigOrBankCode.toUpperCase()) || this.registeredFormats.get("STANDARD_CSV")!;
    } else {
      config = formatConfigOrBankCode;
    }

    if (!config) {
      config = this.registeredFormats.get("STANDARD_CSV")!;
    }

    const lines: string[] = [];

    // Header line
    if (config.includeHeader) {
      const headerLine = config.columns
        .map((col) => (config!.quoteStrings ? `"${col.headerName}"` : col.headerName))
        .join(config.delimiter);
      lines.push(headerLine);
    }

    // Row lines
    for (const record of records) {
      const rowValues = config.columns.map((col) => {
        let val = "";
        switch (col.fieldSource) {
          case "ACCOUNT_NUMBER":
            val = record.accountNumber || col.defaultValue || "";
            break;
          case "NET_AMOUNT":
            val = col.format === "NO_DECIMALS" ? Math.round(record.amount).toString() : record.amount.toFixed(2);
            break;
          case "BENEFICIARY_NAME":
            val = record.beneficiaryName || col.defaultValue || "";
            break;
          case "IFSC_CODE":
            val = record.ifscCode || col.defaultValue || "";
            break;
          case "REMARKS":
            val = record.remarks || col.defaultValue || "SALARY";
            break;
          case "EMAIL":
            val = record.email || col.defaultValue || "";
            break;
          case "EMPLOYEE_CODE":
            val = record.employeeCode || col.defaultValue || "";
            break;
          case "BANK_NAME":
            val = record.bankName || col.defaultValue || "";
            break;
          case "BRANCH_NAME":
            val = record.branchName || col.defaultValue || "";
            break;
          case "PAYMENT_DATE":
            val = record.paymentDate || new Date().toISOString().split("T")[0];
            if (col.format === "DD/MM/YYYY") {
              const parts = val.split("-");
              if (parts.length === 3) val = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else if (col.format === "YYYYMMDD") {
              val = val.replace(/-/g, "");
            }
            break;
          case "STATIC_VALUE":
            val = col.staticValue || col.defaultValue || "";
            break;
        }

        if (col.fixedWidth && col.fixedWidth > 0) {
          val = val.padEnd(col.fixedWidth, " ").substring(0, col.fixedWidth);
        }

        return config!.quoteStrings ? `"${val}"` : val;
      });

      lines.push(rowValues.join(config.delimiter));
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `Payout_${config.bankCode}_${timestamp}.${config.fileExtension}`;

    return {
      fileContent: lines.join("\n"),
      mimeType: config.mimeType,
      filename,
    };
  }

  public static async formatBankExportXlsx(
    records: BankDisbursementRecord[],
    formatConfigOrBankCode: DynamicBankPayoutConfig | string
  ): Promise<{ fileBuffer: Buffer; mimeType: string; filename: string }> {
    let config: DynamicBankPayoutConfig | undefined;

    if (typeof formatConfigOrBankCode === "string") {
      config = this.registeredFormats.get(formatConfigOrBankCode.toUpperCase()) || this.registeredFormats.get("STANDARD_CSV")!;
    } else {
      config = formatConfigOrBankCode;
    }

    if (!config) {
      config = this.registeredFormats.get("STANDARD_CSV")!;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Salary Disbursement");

    worksheet.columns = config.columns.map((col) => ({
      header: col.headerName,
      key: col.headerName.replace(/\s+/g, "_"),
      width: Math.max(col.headerName.length + 5, 18),
    }));

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2886CE" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 24;

    for (const record of records) {
      const rowData: Record<string, any> = {};
      config.columns.forEach((col) => {
        let val: any = "";
        switch (col.fieldSource) {
          case "ACCOUNT_NUMBER":
            val = record.accountNumber || col.defaultValue || "";
            break;
          case "NET_AMOUNT":
            val = Number(record.amount.toFixed(2));
            break;
          case "BENEFICIARY_NAME":
            val = record.beneficiaryName || col.defaultValue || "";
            break;
          case "IFSC_CODE":
            val = record.ifscCode || col.defaultValue || "";
            break;
          case "REMARKS":
            val = record.remarks || col.defaultValue || "SALARY";
            break;
          case "EMAIL":
            val = record.email || col.defaultValue || "";
            break;
          case "EMPLOYEE_CODE":
            val = record.employeeCode || col.defaultValue || "";
            break;
          case "BANK_NAME":
            val = record.bankName || col.defaultValue || "";
            break;
          case "BRANCH_NAME":
            val = record.branchName || col.defaultValue || "";
            break;
          case "PAYMENT_DATE":
            val = record.paymentDate || new Date().toISOString().split("T")[0];
            break;
          case "STATIC_VALUE":
            val = col.staticValue || col.defaultValue || "";
            break;
        }
        rowData[col.headerName.replace(/\s+/g, "_")] = val;
      });
      worksheet.addRow(rowData);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `Payout_${config.bankCode}_${timestamp}.xlsx`;

    return {
      fileBuffer: Buffer.from(buffer),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
    };
  }

  public static buildDisbursementRecords(
    run: PayrollRunDocument,
    payslips: any[]
  ): BankDisbursementRecord[] {
    const records: BankDisbursementRecord[] = [];
    const runMonth = run.month;
    const runYear = run.year;

    for (const payslip of payslips) {
      const emp = payslip.employeeId || {};
      const bankDetails = emp.bankDetails || {};

      records.push({
        accountNumber: bankDetails.accountNumber || "000000000000",
        amount: payslip.netPayable || 0,
        beneficiaryName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "EMPLOYEE",
        ifscCode: bankDetails.ifscCode || "BANK0000000",
        remarks: `Salary ${runMonth}/${runYear}`,
        email: emp.email || emp.contactDetails?.workEmail,
        employeeCode: emp.employeeCode,
        bankName: bankDetails.bankName,
        branchName: bankDetails.branchName,
        paymentDate: new Date().toISOString().split("T")[0],
      });
    }

    return records;
  }
}
