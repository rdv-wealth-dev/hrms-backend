import mongoose from "mongoose";
import csvParser from "csv-parser";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { RequestContext } from "../../../core/interfaces/request-context.interface";
import { EmployeeModel, EmployeeStatus, EmployeeType, Gender } from "./employee.model";
import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";
import { BranchModel } from "../../branch/branch.model";
import { getNextEmployeeCode } from "./employee-counter.util";

export interface BulkImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchName: string;
  departmentName: string;
  designationName: string;
  joiningDate: string;
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

export interface ParsedImportData {
  validRecords: any[];
  totalRows: number;
  errors: ImportError[];
}

export async function parseImportFile(
  context: RequestContext,
  buffer: Buffer,
  fileType: "csv" | "xlsx"
): Promise<ParsedImportData> {
  const rawRows = fileType === "csv" 
    ? await parseCSV(buffer) 
    : await parseExcel(buffer);

  if (!rawRows || rawRows.length === 0) {
    return { validRecords: [], totalRows: 0, errors: [{ rowNumber: 0, reason: "File is empty" }] };
  }

  const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);
  const userIdObj = new mongoose.Types.ObjectId(context.userId);

  const [branches, departments, designations] = await Promise.all([
    BranchModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
    DepartmentModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
    DesignationModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("_id name").lean(),
  ]);

  const branchMap = new Map(branches.map(b => [b.name.trim().toLowerCase(), b._id]));
  const departmentMap = new Map(departments.map(d => [d.name.trim().toLowerCase(), d._id]));
  const designationMap = new Map(designations.map(d => [d.name.trim().toLowerCase(), d._id]));

  const existingEmployees = await EmployeeModel.find({ tenantId: tenantIdObj, isDeleted: false }).select("email").lean();
  const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

  const errors: ImportError[] = [];
  const validRecords: any[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // header is row 1
    const emailClean = row.email?.trim().toLowerCase();

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
      createdBy: userIdObj,
      updatedBy: userIdObj,
    };

    validRecords.push(employeeDoc);
    existingEmails.add(emailClean);
  }

  return {
    validRecords,
    totalRows: rawRows.length,
    errors,
  };
}

export async function buildExportBuffer(
  employees: any[],
  format: "csv" | "xlsx"
): Promise<Buffer> {
  if (format === "csv") {
    let csvContent = "Employee Code,First Name,Last Name,Email,Phone,Branch,Department,Designation,Status,Joining Date,Employee Type\n";
    for (const emp of employees) {
      const branchName = emp.branchId?.name || "";
      const deptName = emp.departmentId?.name || "";
      const desigName = emp.designationId?.name || "";
      const joiningDate = emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "";

      csvContent += [
        `"${emp.employeeCode || ""}"`,
        `"${emp.firstName || ""}"`,
        `"${emp.lastName || ""}"`,
        `"${emp.email || ""}"`,
        `"${emp.phone || ""}"`,
        `"${branchName}"`,
        `"${deptName}"`,
        `"${desigName}"`,
        `"${emp.status || ""}"`,
        `"${joiningDate}"`,
        `"${emp.employeeType || ""}"`,
      ].join(",") + "\n";
    }
    return Buffer.from(csvContent, "utf-8");
  } else {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employees");

    worksheet.columns = [
      { header: "Employee Code", key: "employeeCode", width: 15 },
      { header: "First Name", key: "firstName", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Branch", key: "branch", width: 20 },
      { header: "Department", key: "department", width: 20 },
      { header: "Designation", key: "designation", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Joining Date", key: "joiningDate", width: 15 },
      { header: "Employee Type", key: "employeeType", width: 15 },
    ];

    for (const emp of employees) {
      worksheet.addRow({
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone || "",
        branch: emp.branchId?.name || "",
        department: emp.departmentId?.name || "",
        designation: emp.designationId?.name || "",
        status: emp.status,
        joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "",
        employeeType: emp.employeeType,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

async function parseCSV(buffer: Buffer): Promise<BulkImportRow[]> {
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

async function parseExcel(buffer: Buffer): Promise<BulkImportRow[]> {
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
