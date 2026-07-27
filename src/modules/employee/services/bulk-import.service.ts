import mongoose from "mongoose";
import csvParser from "csv-parser";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { RequestContext } from "../../../core/interfaces/request-context.interface";
import { EmployeeModel, EmployeeStatus, EmployeeType, Gender, BloodGroup, MaritalStatus } from "../../employee/core/employee.model";
import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";
import { BranchModel } from "../../branch/branch.model";
import { getNextEmployeeCode } from "../core/employee-counter.util";
import { recalculateProfileCompletion } from "../profile/profile-completion.util";

export interface BulkImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchName: string;
  departmentName: string;
  designationName: string;
  joiningDate: string; // YYYY-MM-DD
  employeeType?: string;
  gender?: string;
  dateOfBirth?: string;
  pan?: string;
  aadhaar?: string;
}

export interface ImportError {
  rowNumber: number;
  email?: string;
  reason: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
}

export class BulkImportService {
  private readonly BATCH_SIZE = 250;

  /**
   * Main import processing method
   */
  async processBulkImport(
    context: RequestContext,
    fileBuffer: Buffer,
    fileType: "csv" | "xlsx"
  ): Promise<BulkImportResult> {
    const rawRows = fileType === "csv" 
      ? await this.parseCSV(fileBuffer) 
      : await this.parseExcel(fileBuffer);

    if (!rawRows || rawRows.length === 0) {
      return { totalRows: 0, successCount: 0, errorCount: 0, errors: [{ rowNumber: 0, reason: "File is empty" }] };
    }

    // 1. Pre-fetch and cache Tenant Metadata for O(1) Relational Lookup
    const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);
    
    const [branches, departments, designations] = await Promise.all([
      BranchModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
      DepartmentModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
      DesignationModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
    ]);

    const branchMap = new Map(branches.map(b => [b.name.trim().toLowerCase(), b._id]));
    const departmentMap = new Map(departments.map(d => [d.name.trim().toLowerCase(), d._id]));
    const designationMap = new Map(designations.map(d => [d.name.trim().toLowerCase(), d._id]));

    // Cache existing emails to prevent duplicate creation in batch
    const existingEmployees = await EmployeeModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("email").lean();
    const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

    const errors: ImportError[] = [];
    let successCount = 0;

    // 2. Process records in batches
    for (let i = 0; i < rawRows.length; i += this.BATCH_SIZE) {
      const chunk = rawRows.slice(i, i + this.BATCH_SIZE);
      const bulkOps: any[] = [];
      const createdEmployeeIds: string[] = [];

      for (let idx = 0; idx < chunk.length; idx++) {
        const row = chunk[idx];
        const rowNumber = i + idx + 2; // Accounting for 1-based index and header row

        const emailClean = row.email?.trim().toLowerCase();
        
        // Basic Validations
        if (!emailClean) {
          errors.push({ rowNumber, reason: "Email is required" });
          continue;
        }
        if (existingEmails.has(emailClean)) {
          errors.push({ rowNumber, email: emailClean, reason: "Employee with this email already exists" });
          continue;
        }
        if (!row.firstName || !row.lastName) {
          errors.push({ rowNumber, email: emailClean, reason: "First name and Last name are required" });
          continue;
        }

        // Relational Lookups
        const branchId = branchMap.get(row.branchName?.trim().toLowerCase());
        const departmentId = departmentMap.get(row.departmentName?.trim().toLowerCase());
        const designationId = designationMap.get(row.designationName?.trim().toLowerCase());

        if (!branchId) {
          errors.push({ rowNumber, email: emailClean, reason: `Branch "${row.branchName}" not found` });
          continue;
        }
        if (!departmentId) {
          errors.push({ rowNumber, email: emailClean, reason: `Department "${row.departmentName}" not found` });
          continue;
        }
        if (!designationId) {
          errors.push({ rowNumber, email: emailClean, reason: `Designation "${row.designationName}" not found` });
          continue;
        }

        const joiningDate = new Date(row.joiningDate);
        if (isNaN(joiningDate.getTime())) {
          errors.push({ rowNumber, email: emailClean, reason: "Invalid joining date format (Use YYYY-MM-DD)" });
          continue;
        }

        // Generate Atomic Employee Code per Tenant
        const employeeCode = await getNextEmployeeCode(context.tenantId);
        const newEmpId = new mongoose.Types.ObjectId();

        const employeeDoc = {
          _id: newEmpId,
          tenantId: tenantIdObj,
          branchId,
          departmentId,
          designationId,
          employeeCode,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: emailClean,
          phone: row.phone?.trim(),
          joiningDate,
          employeeType: Object.values(EmployeeType).includes(row.employeeType as any) ? row.employeeType : EmployeeType.FULL_TIME,
          status: EmployeeStatus.ACTIVE,
          gender: Object.values(Gender).includes(row.gender as any) ? row.gender : undefined,
          dateOfBirth: row.dateOfBirth && !isNaN(new Date(row.dateOfBirth).getTime()) ? new Date(row.dateOfBirth) : undefined,
          pan: row.pan?.trim().toUpperCase(),
          aadhaar: row.aadhaar?.trim(),
          isActive: true,
          onboardingStep: 1,
          onboardingComplete: false,
          isProfileComplete: false,
          createdBy: new mongoose.Types.ObjectId(context.userId),
          updatedBy: new mongoose.Types.ObjectId(context.userId),
        };

        bulkOps.push({
          insertOne: {
            document: employeeDoc,
          },
        });

        existingEmails.add(emailClean); // Prevent duplicate emails in same file
        createdEmployeeIds.push(newEmpId.toString());
      }

      if (bulkOps.length > 0) {
        await EmployeeModel.bulkWrite(bulkOps, { ordered: false });
        successCount += bulkOps.length;

        // Recalculate Profile Completion status asynchronously for imported employees
        for (const empId of createdEmployeeIds) {
          recalculateProfileCompletion(context.tenantId, empId).catch(() => {});
        }
      }
    }

    return {
      totalRows: rawRows.length,
      successCount,
      errorCount: errors.length,
      errors,
    };
  }

  private async parseCSV(buffer: Buffer): Promise<BulkImportRow[]> {
    return new Promise((resolve, reject) => {
      const results: BulkImportRow[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csvParser())
        .on("data", (data) => {
          results.push({
            firstName: data.firstName || data.first_name || data["First Name"],
            lastName: data.lastName || data.last_name || data["Last Name"],
            email: data.email || data["Email Address"],
            phone: data.phone || data["Phone Number"],
            branchName: data.branchName || data.branch || data["Branch"],
            departmentName: data.departmentName || data.department || data["Department"],
            designationName: data.designationName || data.designation || data["Designation"],
            joiningDate: data.joiningDate || data.joining_date || data["Joining Date"],
            employeeType: data.employeeType || data.employee_type || data["Employee Type"],
            gender: data.gender || data["Gender"],
            dateOfBirth: data.dateOfBirth || data.dob || data["Date of Birth"],
            pan: data.pan || data["PAN"],
            aadhaar: data.aadhaar || data["Aadhaar"],
          });
        })
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
  }

  private async parseExcel(buffer: Buffer): Promise<BulkImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    const results: BulkImportRow[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      if (rowNumber === 1) {
        headers = values.map(v => String(v ?? "").trim().toLowerCase());
        return;
      }

      const rowObj: any = {};
      headers.forEach((header, index) => {
        if (header) {
          rowObj[header] = values[index];
        }
      });

      results.push({
        firstName: rowObj["firstname"] || rowObj["first_name"] || rowObj["first name"],
        lastName: rowObj["lastname"] || rowObj["last_name"] || rowObj["last name"],
        email: rowObj["email"] || rowObj["email address"],
        phone: rowObj["phone"] || rowObj["phone number"],
        branchName: rowObj["branchname"] || rowObj["branch"],
        departmentName: rowObj["departmentname"] || rowObj["department"],
        designationName: rowObj["designationname"] || rowObj["designation"],
        joiningDate: rowObj["joiningdate"] || rowObj["joining_date"] || rowObj["joining date"],
        employeeType: rowObj["employeetype"] || rowObj["employee_type"] || rowObj["employee type"],
        gender: rowObj["gender"],
        dateOfBirth: rowObj["dateofbirth"] || rowObj["dob"] || rowObj["date of birth"],
        pan: rowObj["pan"],
        aadhaar: rowObj["aadhaar"],
      });
    });

    return results;
  }
}