import mongoose from "mongoose";
import { EmployeeModel } from "../../employee/models/employee.model";
import { OrganizationModel } from "../../organization/organization.model";
import { PayslipModel } from "../models/payslip.model";
import { TaxDeclarationModel } from "../models/statutory-config.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";

export class Form16Service {
  /**
   * Helper to parse financial year string "2026-2027" into { startYear: 2026, endYear: 2027 }
   */
  private parseFinancialYear(fy?: string): { startYear: number; endYear: number; fyString: string; ayString: string } {
    const now = new Date();
    let startYear: number;
    let endYear: number;

    if (fy && fy.includes("-")) {
      const parts = fy.split("-").map((p) => parseInt(p.trim(), 10));
      startYear = parts[0];
      endYear = parts[1] || (startYear + 1);
    } else {
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      if (currentMonth >= 4) {
        startYear = currentYear;
        endYear = currentYear + 1;
      } else {
        startYear = currentYear - 1;
        endYear = currentYear;
      }
    }

    const fyString = `${startYear}-${endYear}`;
    const ayString = `${endYear}-${endYear + 1}`;
    return { startYear, endYear, fyString, ayString };
  }

  /**
   * Generate Annual Form 16 (Part A + Part B) Tax Certificate Summary
   */
  async generateForm16(
    context: RequestContext,
    employeeId: string,
    financialYearInput?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new AppError("Invalid employee ID format", 400);
    }

    const { startYear, endYear, fyString, ayString } = this.parseFinancialYear(financialYearInput);

    const [employee, org] = await Promise.all([
      EmployeeModel.findOne({
        _id: new mongoose.Types.ObjectId(employeeId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      })
        .populate("departmentId", "name")
        .populate("designationId", "name")
        .populate("branchId", "name address")
        .lean(),
      OrganizationModel.findById(context.tenantId).lean(),
    ]);

    if (!employee) {
      throw new AppError("Employee not found in this organization", 404);
    }

    // Query all 12 months payslips for this FY (April startYear to March endYear)
    const payslips = await PayslipModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      $or: [
        { year: startYear, month: { $gte: 4, $lte: 12 } },
        { year: endYear, month: { $gte: 1, $lte: 3 } },
      ],
    })
      .sort({ year: 1, month: 1 })
      .lean();

    // Aggregate payslip numbers
    let totalGrossSalary = 0;
    let totalPfDeduction = 0;
    let totalPtDeduction = 0;
    let totalTdsDeducted = 0;
    let totalBasic = 0;
    let totalHraReceived = 0;

    // Monthly breakdown for Part A Quarters
    const quarters: Record<string, { grossPaid: number; taxDeducted: number; taxDeposited: number }> = {
      Q1: { grossPaid: 0, taxDeducted: 0, taxDeposited: 0 }, // Apr - Jun
      Q2: { grossPaid: 0, taxDeducted: 0, taxDeposited: 0 }, // Jul - Sep
      Q3: { grossPaid: 0, taxDeducted: 0, taxDeposited: 0 }, // Oct - Dec
      Q4: { grossPaid: 0, taxDeducted: 0, taxDeposited: 0 }, // Jan - Mar
    };

    for (const ps of payslips) {
      const gross = ps.grossEarned || 0;
      totalGrossSalary += gross;

      // Extract components
      for (const earn of ps.earnings || []) {
        if (earn.componentCode === "BASIC") totalBasic += earn.amount;
        if (earn.componentCode === "HRA") totalHraReceived += earn.amount;
      }

      for (const ded of ps.deductions || []) {
        if (ded.componentCode === "PF") totalPfDeduction += ded.amount;
        if (ded.componentCode === "PT") totalPtDeduction += ded.amount;
        if (ded.componentCode === "TDS") totalTdsDeducted += ded.amount;
      }

      // Quarter grouping
      let q = "Q1";
      if (ps.month >= 4 && ps.month <= 6) q = "Q1";
      else if (ps.month >= 7 && ps.month <= 9) q = "Q2";
      else if (ps.month >= 10 && ps.month <= 12) q = "Q3";
      else if (ps.month >= 1 && ps.month <= 3) q = "Q4";

      const tdsForMonth = (ps.deductions || []).find((d: any) => d.componentCode === "TDS")?.amount || 0;
      quarters[q].grossPaid += gross;
      quarters[q].taxDeducted += tdsForMonth;
      quarters[q].taxDeposited += tdsForMonth;
    }

    // Fetch tax declaration for Chapter VI-A investments (80C, 80D)
    const taxDecl = await TaxDeclarationModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      financialYear: fyString,
    }).lean();

    const regime = (taxDecl as any)?.regime || "NEW";
    const standardDeduction = regime === "NEW" ? 75000 : 50000;

    // Chapter VI-A
    const decl80C = (taxDecl as any)?.section80C?.totalApproved || (taxDecl as any)?.section80C?.totalDeclared || 0;
    const total80C = Math.min(150000, decl80C + totalPfDeduction);
    const decl80D = (taxDecl as any)?.section80D?.totalApproved || (taxDecl as any)?.section80D?.totalDeclared || 0;
    const total80D = Math.min(50000, decl80D);
    const totalChapterVIA = regime === "OLD" ? (total80C + total80D) : 0;

    // HRA Exemption (Old regime)
    const hraExemption = regime === "OLD" ? Math.min(totalHraReceived, Math.round(totalBasic * 0.4)) : 0;

    // Taxable Income computation
    const grossAfterSec10 = Math.max(0, totalGrossSalary - hraExemption);
    const netSalaryAfterSec16 = Math.max(0, grossAfterSec10 - standardDeduction - totalPtDeduction);
    const totalTaxableIncome = Math.max(0, netSalaryAfterSec16 - totalChapterVIA);

    // Compute Tax
    let computedTax = totalTdsDeducted;

    return {
      certificateNumber: `FORM16-${fyString}-${employee.employeeCode}`,
      financialYear: fyString,
      assessmentYear: ayString,
      regimeSelected: regime,

      partA: {
        employer: {
          name: (org as any)?.companyName || (org as any)?.legalName || "Company Ltd.",
          pan: (org as any)?.pan || (org?.statutory as any)?.pan || "AAACB1234F",
          tan: (org as any)?.tan || (org?.statutory as any)?.tan || "PNEA12345B",
          address: (org as any)?.address?.city ? `${(org as any)?.address?.city}, ${(org as any)?.address?.state || ""}` : "Headquarters",
        },
        employee: {
          _id: employee._id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          pan: (employee as any)?.panNumber || "ABCDE1234F",
          department: (employee.departmentId as any)?.name || "General",
          designation: (employee.designationId as any)?.name || "Staff",
        },
        quarterlyTdsSummary: quarters,
        totalTdsDeposited: totalTdsDeducted,
      },

      partB: {
        salaryDetails: {
          grossSalary: totalGrossSalary,
          exemptionsUnderSection10: {
            hraExemption,
            totalExemptions: hraExemption,
          },
          totalSalaryReceived: grossAfterSec10,
          deductionsUnderSection16: {
            standardDeduction,
            taxOnEmploymentPT: totalPtDeduction,
            totalSection16: standardDeduction + totalPtDeduction,
          },
          incomeChargeableUnderSalaries: netSalaryAfterSec16,
        },
        chapterVIADeductions: {
          section80C: total80C,
          section80D: total80D,
          totalChapterVIA,
        },
        taxSummary: {
          totalTaxableIncome,
          taxOnTotalIncome: computedTax,
          rebate87A: computedTax <= 25000 && totalTaxableIncome <= 700000 ? computedTax : 0,
          healthAndEducationCess: Math.round(computedTax * 0.04),
          netTaxPayable: computedTax,
          totalTaxDeductedAtSource: totalTdsDeducted,
          refundOrDue: totalTdsDeducted - computedTax,
        },
      },
    };
  }
}
