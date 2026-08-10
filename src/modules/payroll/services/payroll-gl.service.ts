import mongoose from "mongoose";
import { PayrollRunRepository } from "../repositories/payroll-run.repository";
import { PayslipRepository } from "../repositories/payslip.repository";
import { PayrollGLConfigRepository } from "../repositories/payroll-gl-config.repository";
import { AppError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";

export enum GLJournalFormat {
  JSON = "JSON",
  CSV = "CSV",
  TALLY_XML = "TALLY_XML",
}

export class PayrollGLService {
  private runRepo = new PayrollRunRepository();
  private payslipRepo = new PayslipRepository();
  private glConfigRepo = new PayrollGLConfigRepository();

  async getGLConfig(context: RequestContext) {
    return this.glConfigRepo.findByTenant(context);
  }

  async updateGLConfig(context: RequestContext, data: any) {
    return this.glConfigRepo.upsertConfig(context, data);
  }

  async generateGLJournal(
    context: RequestContext,
    runId: string,
    format: GLJournalFormat = GLJournalFormat.JSON
  ) {
    const run = await this.runRepo.findById(context, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    const payslips = await this.payslipRepo.findByRun(context, runId);
    const glConfig = await this.glConfigRepo.findByTenant(context);

    // Sum all components from payslips
    let totalGross = 0;
    let totalNet = 0;
    let totalEmployeePf = 0;
    let totalEmployerPf = 0;
    let totalEmployeeEsi = 0;
    let totalEmployerEsi = 0;
    let totalPt = 0;
    let totalEmployeeLwf = 0;
    let totalEmployerLwf = 0;
    let totalTds = 0;
    let totalGratuity = 0;

    for (const p of payslips) {
      totalGross += p.grossEarned || 0;
      totalNet += p.netPay || 0;
      totalEmployeePf += p.pfEmployeeContribution || 0;
      totalEmployerPf += p.pfEmployerContribution || 0;
      totalEmployeeEsi += p.esiEmployeeContribution || 0;
      totalEmployerEsi += p.esiEmployerContribution || 0;
      totalPt += p.ptAmount || 0;
      totalEmployeeLwf += p.lwfEmployeeAmount || 0;
      totalEmployerLwf += p.lwfEmployerAmount || 0;
      totalTds += p.tdsAmount || 0;
      totalGratuity += p.gratuityMonthlyProvision || 0;
    }

    const round = (val: number) => Math.round(val * 100) / 100;

    const totalPfPayable = round(totalEmployeePf + totalEmployerPf);
    const totalEsiPayable = round(totalEmployeeEsi + totalEmployerEsi);
    const totalLwfPayable = round(totalEmployeeLwf + totalEmployerLwf);

    // Prepare Double-Entry Journal Lines
    const journalEntries: {
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
      narration: string;
    }[] = [];

    const narrationPeriod = `Payroll Expense for ${run.runLabel}`;

    // ── DEBITS (Expenses) ──
    if (totalGross > 0) {
      journalEntries.push({
        accountCode: glConfig.grossSalaryExpenseAccount.accountCode,
        accountName: glConfig.grossSalaryExpenseAccount.accountName,
        debit: round(totalGross),
        credit: 0,
        narration: narrationPeriod,
      });
    }

    if (totalEmployerPf > 0) {
      journalEntries.push({
        accountCode: glConfig.employerPfExpenseAccount.accountCode,
        accountName: glConfig.employerPfExpenseAccount.accountName,
        debit: round(totalEmployerPf),
        credit: 0,
        narration: `Employer PF contribution for ${run.runLabel}`,
      });
    }

    if (totalEmployerEsi > 0) {
      journalEntries.push({
        accountCode: glConfig.employerEsiExpenseAccount.accountCode,
        accountName: glConfig.employerEsiExpenseAccount.accountName,
        debit: round(totalEmployerEsi),
        credit: 0,
        narration: `Employer ESI contribution for ${run.runLabel}`,
      });
    }

    if (totalEmployerLwf > 0) {
      journalEntries.push({
        accountCode: "5006",
        accountName: "Employer LWF Expense",
        debit: round(totalEmployerLwf),
        credit: 0,
        narration: `Employer LWF contribution for ${run.runLabel}`,
      });
    }

    if (totalGratuity > 0) {
      journalEntries.push({
        accountCode: glConfig.gratuityExpenseAccount.accountCode,
        accountName: glConfig.gratuityExpenseAccount.accountName,
        debit: round(totalGratuity),
        credit: 0,
        narration: `Gratuity provision accrual for ${run.runLabel}`,
      });
    }

    // ── CREDITS (Liabilities & Net Payout) ──
    if (totalNet > 0) {
      journalEntries.push({
        accountCode: glConfig.salariesPayableAccount.accountCode,
        accountName: glConfig.salariesPayableAccount.accountName,
        debit: 0,
        credit: round(totalNet),
        narration: `Net salary payable to employees for ${run.runLabel}`,
      });
    }

    if (totalPfPayable > 0) {
      journalEntries.push({
        accountCode: glConfig.pfPayableAccount.accountCode,
        accountName: glConfig.pfPayableAccount.accountName,
        debit: 0,
        credit: totalPfPayable,
        narration: `PF liability (EE ₹${round(totalEmployeePf)} + ER ₹${round(totalEmployerPf)}) for ${run.runLabel}`,
      });
    }

    if (totalEsiPayable > 0) {
      journalEntries.push({
        accountCode: glConfig.esiPayableAccount.accountCode,
        accountName: glConfig.esiPayableAccount.accountName,
        debit: 0,
        credit: totalEsiPayable,
        narration: `ESI liability (EE ₹${round(totalEmployeeEsi)} + ER ₹${round(totalEmployerEsi)}) for ${run.runLabel}`,
      });
    }

    if (totalPt > 0) {
      journalEntries.push({
        accountCode: glConfig.ptPayableAccount.accountCode,
        accountName: glConfig.ptPayableAccount.accountName,
        debit: 0,
        credit: round(totalPt),
        narration: `Professional Tax liability for ${run.runLabel}`,
      });
    }

    if (totalLwfPayable > 0) {
      journalEntries.push({
        accountCode: glConfig.lwfPayableAccount.accountCode,
        accountName: glConfig.lwfPayableAccount.accountName,
        debit: 0,
        credit: totalLwfPayable,
        narration: `LWF liability (EE ₹${round(totalEmployeeLwf)} + ER ₹${round(totalEmployerLwf)}) for ${run.runLabel}`,
      });
    }

    if (totalTds > 0) {
      journalEntries.push({
        accountCode: glConfig.tdsPayableAccount.accountCode,
        accountName: glConfig.tdsPayableAccount.accountName,
        debit: 0,
        credit: round(totalTds),
        narration: `TDS on salary liability (Section 192) for ${run.runLabel}`,
      });
    }

    if (totalGratuity > 0) {
      journalEntries.push({
        accountCode: "2015",
        accountName: "Gratuity Provision Liability",
        debit: 0,
        credit: round(totalGratuity),
        narration: `Gratuity provision liability for ${run.runLabel}`,
      });
    }

    const totalDebits = round(journalEntries.reduce((sum, j) => sum + j.debit, 0));
    const totalCredits = round(journalEntries.reduce((sum, j) => sum + j.credit, 0));
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.05;

    const voucherNumber = `JV-PAY-${run.year}-${String(run.month).padStart(2, "0")}`;
    const voucherDate = new Date().toISOString().slice(0, 10);

    if (format === GLJournalFormat.CSV) {
      const headers = "Voucher_Number,Voucher_Date,Account_Code,Account_Name,Debit_Amount,Credit_Amount,Narration";
      const rows = journalEntries.map((j) => {
        return `${voucherNumber},${voucherDate},${j.accountCode},"${j.accountName.replace(/"/g, '""')}",${j.debit.toFixed(2)},${j.credit.toFixed(2)},"${j.narration.replace(/"/g, '""')}"`;
      });
      const content = [headers, ...rows].join("\r\n");
      return {
        filename: `GL_Journal_Voucher_${run.year}_${run.month}.csv`,
        contentType: "text/csv",
        content,
      };
    }

    if (format === GLJournalFormat.TALLY_XML) {
      const tallyDate = voucherDate.replace(/-/g, "");
      const xmlEntries = journalEntries
        .map((j) => {
          const isDebit = j.debit > 0;
          const amount = isDebit ? -j.debit : j.credit; // In Tally, Debits are negative in ALLLEDGERENTRIES
          return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${j.accountName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        })
        .join("");

      const content = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
            <NARRATION>${narrationPeriod}</NARRATION>
            ${xmlEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

      return {
        filename: `Tally_Journal_Voucher_${run.year}_${run.month}.xml`,
        contentType: "application/xml",
        content,
      };
    }

    // Default JSON response
    return {
      voucherNumber,
      voucherDate,
      period: run.runLabel,
      totalDebits,
      totalCredits,
      isBalanced,
      journalEntries,
    };
  }
}
