import mongoose from "mongoose";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayslipRepository } from "../repositories/payslip.repository";
import { EmployeeModel } from "../../employee/models/employee.model";
import { EmployeeBankAccountModel } from "../../employee/models/employee-bank-account.model";
import { OrganizationModel } from "../../organization/organization.model";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export enum DisbursementFormat {
  GENERIC_CSV = "GENERIC_CSV",
  HDFC_CMS = "HDFC_CMS",
  ICICI_CMS = "ICICI_CMS",
  SBI_DIRECT = "SBI_DIRECT",
  NACHA_ACH = "NACHA_ACH",
}

export class PayrollDisbursementService {
  private runRepo = new PayrollRunRepository();
  private payslipRepo = new PayslipRepository();

  private async getDisbursementData(context: RequestContext, runId: string) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    const payslips = await this.payslipRepo.findByRun(context, runId);
    const employeeIds = payslips.map((p) => p.employeeId.toString());

    const [employees, bankAccounts, organization] = await Promise.all([
      EmployeeModel.find({
        _id: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      })
        .select("_id employeeCode firstName lastName email phone")
        .lean(),
      EmployeeBankAccountModel.find({
        employeeId: { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
      }).lean(),
      OrganizationModel.findById(context.tenantId).lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e._id.toString(), e]));

    // Map primary bank account per employee
    const bankMap = new Map<string, any>();
    for (const bank of bankAccounts) {
      const empId = bank.employeeId.toString();
      if (!bankMap.has(empId) || bank.isPrimary) {
        bankMap.set(empId, bank);
      }
    }

    const items = payslips.map((payslip) => {
      const empId = payslip.employeeId.toString();
      const emp = empMap.get(empId);
      const bank = bankMap.get(empId);

      return {
        payslipId: payslip._id.toString(),
        employeeId: empId,
        employeeCode: emp?.employeeCode || "N/A",
        employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Unknown",
        email: emp?.email || "",
        phone: emp?.phone || "",
        bankName: bank?.bankName || "",
        accountNumber: bank?.accountNumber || "",
        ifscCode: bank?.ifscCode || "",
        accountType: bank?.accountType || "SAVINGS",
        hasValidBank: !!(bank?.accountNumber && bank?.ifscCode),
        netPay: payslip.netPay,
        month: run.month,
        year: run.year,
        narration: `Salary for ${run.month}/${run.year}`,
      };
    });

    return {
      run,
      organization,
      items,
    };
  }

  async getDisbursementSummary(context: RequestContext, runId: string) {
    const { run, items } = await this.getDisbursementData(context, runId);
    const validAccounts = items.filter((i) => i.hasValidBank && i.netPay > 0);
    const invalidAccounts = items.filter((i) => !i.hasValidBank || i.netPay <= 0);

    const totalDisbursementAmount = validAccounts.reduce((sum, i) => sum + i.netPay, 0);

    return {
      runId,
      runLabel: run.runLabel,
      status: run.status,
      totalEmployees: items.length,
      payableCount: validAccounts.length,
      unpayableCount: invalidAccounts.length,
      totalDisbursementAmount: Math.round(totalDisbursementAmount * 100) / 100,
      unpayableEmployees: invalidAccounts.map((i) => ({
        employeeCode: i.employeeCode,
        employeeName: i.employeeName,
        netPay: i.netPay,
        reason: !i.hasValidBank ? "Missing or incomplete Bank Account/IFSC" : "Net pay is zero or negative",
      })),
    };
  }

  async generateDisbursementFile(
    context: RequestContext,
    runId: string,
    format: DisbursementFormat = DisbursementFormat.GENERIC_CSV
  ) {
    const { run, organization, items } = await this.getDisbursementData(context, runId);
    const validItems = items.filter((i) => i.hasValidBank && i.netPay > 0);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    switch (format) {
      case DisbursementFormat.HDFC_CMS: {
        // HDFC Corporate CMS layout (Pipe-delimited)
        // Format: TransactionType|BeneficiaryCode|BeneficiaryAccount|Amount|BeneficiaryName|CustomerRefNo|IFSC|BeneficiaryEmail
        const headers = "Transaction_Type|Beneficiary_Code|Account_Number|Amount|Beneficiary_Name|Customer_Ref_No|IFSC_Code|Email|Narration";
        const rows = validItems.map((i) => {
          const txType = i.ifscCode.toUpperCase().startsWith("HDFC") ? "I" : "N"; // Internal vs NEFT
          return `${txType}|${i.employeeCode}|${i.accountNumber}|${i.netPay.toFixed(2)}|${i.employeeName}|${run.runLabel}-${i.employeeCode}|${i.ifscCode}|${i.email}|Salary-${i.month}-${i.year}`;
        });
        const content = [headers, ...rows].join("\r\n");
        return {
          filename: `HDFC_CMS_Payout_${run.year}_${run.month}_${dateStr}.txt`,
          contentType: "text/plain",
          content,
        };
      }

      case DisbursementFormat.ICICI_CMS: {
        // ICICI Bank CIB Salary Upload Layout (Comma-separated)
        // Format: Upload Indicator, Beneficiary Name, Account Number, Amount, IFSC, Narration
        const headers = "Payment_Mode,Beneficiary_Name,Account_Number,Amount,IFSC_Code,Employee_Code,Narration";
        const rows = validItems.map((i) => {
          const mode = i.ifscCode.toUpperCase().startsWith("ICIC") ? "FT" : "NEFT";
          return `${mode},"${i.employeeName.replace(/"/g, '""')}",${i.accountNumber},${i.netPay.toFixed(2)},${i.ifscCode},${i.employeeCode},"Salary for ${i.month}/${i.year}"`;
        });
        const content = [headers, ...rows].join("\r\n");
        return {
          filename: `ICICI_Salary_Payout_${run.year}_${run.month}_${dateStr}.csv`,
          contentType: "text/csv",
          content,
        };
      }

      case DisbursementFormat.SBI_DIRECT: {
        // SBI Direct Credit Batch Format
        const headers = "Account_Number,Amount,Employee_Name,Narration,Transaction_Reference";
        const rows = validItems.map((i) => {
          return `${i.accountNumber},${i.netPay.toFixed(2)},"${i.employeeName.replace(/"/g, '""')}","Salary ${i.month}/${i.year}",${run._id.toString().slice(-8)}-${i.employeeCode}`;
        });
        const content = [headers, ...rows].join("\r\n");
        return {
          filename: `SBI_Salary_Batch_${run.year}_${run.month}_${dateStr}.csv`,
          contentType: "text/csv",
          content,
        };
      }

      case DisbursementFormat.NACHA_ACH: {
        // Standard US/Global 94-byte fixed length NACHA layout
        const fileCreationDate = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
        const fileCreationTime = new Date().toTimeString().slice(0, 5).replace(/:/g, ""); // HHMM
        const companyName = (organization?.companyName || "COMPANY").padEnd(16).slice(0, 16);
        const compId = "1234567890".padEnd(10).slice(0, 10);

        // Record 1: File Header
        const fileHeader = `101 123456789 ${compId}${fileCreationDate}${fileCreationTime}A09410${companyName.padEnd(23)}ADVANCED HRMS   `;

        // Record 5: Company Batch Header
        const batchHeader = `5200${companyName}                    ${compId}PPDDIRECT PAY${fileCreationDate}${fileCreationDate}   1012345670000001`;

        let entrySeq = 0;
        let totalCents = 0;
        const entryRecords: string[] = [];

        for (const item of validItems) {
          entrySeq++;
          const cents = Math.round(item.netPay * 100);
          totalCents += cents;
          const routing = (item.ifscCode || "12345678").padEnd(8, "0").slice(0, 8);
          const checkDigit = "0";
          const dfaAccount = item.accountNumber.padEnd(17).slice(0, 17);
          const amtStr = String(cents).padStart(10, "0");
          const indId = item.employeeCode.padEnd(15).slice(0, 15);
          const indName = item.employeeName.padEnd(22).slice(0, 22);
          const traceNo = `01234567${String(entrySeq).padStart(7, "0")}`;

          // Record 6: Entry Detail
          const entry = `622${routing}${checkDigit}${dfaAccount}${amtStr}${indId}${indName}  0${traceNo}`;
          entryRecords.push(entry);
        }

        // Record 8: Batch Control
        const entryCountStr = String(entrySeq).padStart(6, "0");
        const totalAmtStr = String(totalCents).padStart(12, "0");
        const batchControl = `8200${entryCountStr}0000000000000000${totalAmtStr}${compId}                         012345670000001`;

        // Record 9: File Control
        const totalRecords = 1 + 1 + entrySeq + 1 + 1; // File Header + Batch Header + Entries + Batch Control + File Control
        const blockCount = Math.ceil(totalRecords / 10);
        const fileControl = `9000001${String(blockCount).padStart(6, "0")}${entryCountStr}0000000000000000${totalAmtStr}                                       `;

        const achLines = [fileHeader, batchHeader, ...entryRecords, batchControl, fileControl];
        const content = achLines.join("\r\n");

        return {
          filename: `ACH_Direct_Deposit_${run.year}_${run.month}_${dateStr}.ach`,
          contentType: "text/plain",
          content,
        };
      }

      case DisbursementFormat.GENERIC_CSV:
      default: {
        const headers = "Employee_Code,Employee_Name,Email,Phone,Bank_Name,Account_Number,IFSC_Code,Account_Type,Net_Pay,Payment_Month,Payment_Year,Narration";
        const rows = validItems.map((i) => {
          return `${i.employeeCode},"${i.employeeName.replace(/"/g, '""')}",${i.email},${i.phone},"${i.bankName.replace(/"/g, '""')}",'${i.accountNumber}',${i.ifscCode},${i.accountType},${i.netPay.toFixed(2)},${i.month},${i.year},"${i.narration}"`;
        });
        const content = [headers, ...rows].join("\r\n");
        return {
          filename: `Bank_Disbursement_${run.year}_${run.month}_${dateStr}.csv`,
          contentType: "text/csv",
          content,
        };
      }
    }
  }
}
