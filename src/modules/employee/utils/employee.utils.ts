import mongoose from "mongoose";
import csvParser from "csv-parser";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeModel, EmployeeStatus, EmployeeType, Gender } from "../models/employee.model";
import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";
import { BranchModel } from "../../branch/branch.model";
import { getNextEmployeeCode } from "./employee-counter.util";
import { getCountryModule } from "../../../domain/localization/country.registry";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
  countryCode?: string;
}

export interface ImportError {
  rowNumber: number;
  email?: string;
  reason: string;
  severity: "ERROR" | "WARNING";  // ERROR = row skipped, WARNING = row imported with note
}

export interface ParsedImportData {
  validRecords: any[];
  totalRows: number;
  errors: ImportError[];
  warnings: ImportError[];
  created: {
    departments: string[];  // names of departments auto-created
    designations: string[];  // names of designations auto-created
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUZZY MATCHING ENGINE
// Handles: case differences, extra spaces, special chars, common typos
// "software engineer" = "Software Engineer" = "Software  Engineer" = "softwareEngineer"
// ─────────────────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")           // collapse multiple spaces
    .replace(/[^a-z0-9\s]/g, "")   // remove special chars (hyphens, dots etc.)
    .replace(/\s+/g, " ")           // collapse again after special char removal
    .trim();
}

// Levenshtein distance — for catching typos like "Sofware" vs "Software"
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Returns the best matching entry from a map, or null if no close match
// Threshold: edit distance ≤ 2 for short strings, ≤ 3 for longer ones
function fuzzyMatch(
  input: string,
  nameMap: Map<string, any>
): { id: any; matchedName: string; exact: boolean } | null {
  const normalizedInput = normalize(input);

  // 1. Exact normalized match first (fastest path)
  if (nameMap.has(normalizedInput)) {
    return { id: nameMap.get(normalizedInput).id, matchedName: nameMap.get(normalizedInput).name, exact: true };
  }

  // 2. Fuzzy match — find closest entry within edit distance threshold
  let bestMatch: { id: any; matchedName: string; distance: number } | null = null;
  const threshold = normalizedInput.length <= 6 ? 1 : normalizedInput.length <= 12 ? 2 : 3;

  for (const [key, value] of nameMap.entries()) {
    const distance = levenshtein(normalizedInput, key);
    if (distance <= threshold) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { id: value.id, matchedName: value.name, distance };
      }
    }
  }

  if (bestMatch) {
    return { id: bestMatch.id, matchedName: bestMatch.matchedName, exact: false };
  }

  return null;
}

// Build a normalized name → { id, name } map for fast fuzzy lookup
function buildNameMap(docs: { _id: any; name: string }[]): Map<string, { id: any; name: string }> {
  const map = new Map<string, { id: any; name: string }>();
  for (const doc of docs) {
    map.set(normalize(doc.name), { id: doc._id, name: doc.name });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE GENERATOR — for auto-created departments and designations
// "Software Engineering" → "SOFT-ENG", "Human Resources" → "HUM-RES"
// ─────────────────────────────────────────────────────────────────────────────

function generateCode(name: string, existingCodes: Set<string>): string {
  const words = name.trim().toUpperCase().split(/\s+/);
  let base: string;

  if (words.length === 1) {
    base = words[0].slice(0, 8);
  } else {
    base = words.map(w => w.slice(0, 3)).join("-").slice(0, 20);
  }

  // Ensure uniqueness — append number if code already exists
  let code = base;
  let counter = 2;
  while (existingCodes.has(code)) {
    code = `${base}-${counter}`;
    counter++;
  }

  existingCodes.add(code);
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-CREATE DEPARTMENT
// Called when a department name in the import file doesn't exist
// ─────────────────────────────────────────────────────────────────────────────

async function findOrCreateDepartment(
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  name: string,
  nameMap: Map<string, { id: any; name: string }>,
  existingCodes: Set<string>,
  createdNames: string[]
): Promise<{ id: any; name: string; wasCreated: boolean }> {

  // Try fuzzy match first
  const match = fuzzyMatch(name, nameMap);
  if (match) {
    return { id: match.id, name: match.matchedName, wasCreated: false };
  }

  // Not found — auto-create
  const code = generateCode(name, existingCodes);
  const cleanName = name.trim();

  const newDept = await DepartmentModel.create({
    tenantId,
    branchId,
    name: cleanName,
    code,
    description: `Auto-created during bulk employee import`,
    isActive: true,
    createdBy: userId,
    updatedBy: userId,
  });

  // Invalidate master data cache
  const { invalidateMasterDataCache } = require("./master-data-cache");
  invalidateMasterDataCache(tenantId.toString());

  // Add to map so subsequent rows in the same import reuse it
  const normalized = normalize(cleanName);
  nameMap.set(normalized, { id: newDept._id, name: cleanName });
  createdNames.push(cleanName);

  return { id: newDept._id, name: cleanName, wasCreated: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-CREATE DESIGNATION
// Called when a designation name doesn't exist under the resolved department
// ─────────────────────────────────────────────────────────────────────────────

async function findOrCreateDesignation(
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  departmentId: mongoose.Types.ObjectId,
  name: string,
  nameMap: Map<string, { id: any; name: string; departmentId: any }>,
  existingCodes: Set<string>,
  createdNames: string[]
): Promise<{ id: any; name: string; wasCreated: boolean; wrongDept: boolean }> {

  const normalizedInput = normalize(name);

  // 1. Exact match — check if it exists AND belongs to this department
  const exactEntry = nameMap.get(normalizedInput);
  if (exactEntry) {
    const wrongDept = exactEntry.departmentId.toString() !== departmentId.toString();
    return {
      id: exactEntry.id,
      name: exactEntry.name,
      wasCreated: false,
      wrongDept,          // flag: designation exists but under different dept
    };
  }

  // 2. Fuzzy match
  // Build department-scoped map for designation matching
  const deptScopedMap = new Map<string, { id: any; name: string; departmentId: any }>();
  for (const [key, value] of nameMap.entries()) {
    if (value.departmentId.toString() === departmentId.toString()) {
      deptScopedMap.set(key, value);
    }
  }

  const fuzzyEntry = fuzzyMatch(name, deptScopedMap as any);
  if (fuzzyEntry) {
    return {
      id: fuzzyEntry.id,
      name: fuzzyEntry.matchedName,
      wasCreated: false,
      wrongDept: false,
    };
  }

  // 3. Try global fuzzy match (across all departments)
  const globalFuzzy = fuzzyMatch(name, nameMap as any);
  if (globalFuzzy) {
    const entry = nameMap.get(normalize(globalFuzzy.matchedName));
    const wrongDept = entry
      ? entry.departmentId.toString() !== departmentId.toString()
      : false;
    return {
      id: globalFuzzy.id,
      name: globalFuzzy.matchedName,
      wasCreated: false,
      wrongDept,
    };
  }

  // 4. Not found anywhere — auto-create under the resolved department
  const code = generateCode(name, existingCodes);
  const cleanName = name.trim();

  const newDesig = await DesignationModel.create({
    tenantId,
    branchId,
    departmentId,
    name: cleanName,
    code,
    description: `Auto-created during bulk employee import`,
    level: 1,
    isActive: true,
    createdBy: userId,
    updatedBy: userId,
  });

  // Invalidate master data cache
  const { invalidateMasterDataCache } = require("./master-data-cache");
  invalidateMasterDataCache(tenantId.toString());

  const normalized = normalize(cleanName);
  nameMap.set(normalized, { id: newDesig._id, name: cleanName, departmentId });
  createdNames.push(cleanName);

  return { id: newDesig._id, name: cleanName, wasCreated: true, wrongDept: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function parseImportFile(
  context: RequestContext,
  buffer: Buffer,
  fileType: "csv" | "xlsx"
): Promise<ParsedImportData> {

  const rawRows = fileType === "csv"
    ? await parseCSV(buffer)
    : await parseExcel(buffer);

  if (!rawRows || rawRows.length === 0) {
    return {
      validRecords: [],
      totalRows: 0,
      errors: [{ rowNumber: 0, reason: "File is empty or has no data rows", severity: "ERROR" }],
      warnings: [],
      created: { departments: [], designations: [] },
    };
  }

  const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);
  const userIdObj = new mongoose.Types.ObjectId(context.userId);

  // ── Load all existing master data via cache ──
  const { getMasterDataMaps } = require("./master-data-cache");
  const cacheData = await getMasterDataMaps(context.tenantId);
  const branches = cacheData.branches;
  const departments = cacheData.departments;
  const designations = cacheData.designations;

  // Build normalized lookup maps
  const branchMap = buildNameMap(branches);
  const departmentMap = buildNameMap(departments);

  // Designation map includes departmentId for cross-dept validation
  const designationMap = new Map<string, { id: any; name: string; departmentId: any }>();
  for (const d of designations) {
    designationMap.set(normalize(d.name), {
      id: d._id,
      name: d.name,
      departmentId: d.departmentId,
    });
  }

  // Track existing codes to avoid collision during auto-create
  const existingDeptCodes = new Set<string>(departments.map((d: any) => d.code as string));
  const existingDesigCodes = new Set<string>(designations.map((d: any) => d.code as string));

  // Track auto-created names for response summary
  const createdDepts: string[] = [];
  const createdDesigs: string[] = [];

  // Track existing emails to catch duplicates within the import file itself
  const existingEmployees = await EmployeeModel
    .find({ tenantId: tenantIdObj, isDeleted: false })
    .select("email").lean();
  const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

  const errors: ImportError[] = [];
  const warnings: ImportError[] = [];
  const validRecords: any[] = [];

  // ── Per-row processing ────────────────────────────────────────────────────
  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // row 1 = header
    const emailClean = row.email?.trim().toLowerCase();

    // ── Required field checks ──────────────────────────────────────────────
    if (!emailClean) {
      errors.push({ rowNumber, reason: "Email is required", severity: "ERROR" });
      continue;
    }
    if (existingEmails.has(emailClean)) {
      errors.push({ rowNumber, email: emailClean, reason: "Employee with this email already exists", severity: "ERROR" });
      continue;
    }
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ rowNumber, email: emailClean, reason: "First name and last name are required", severity: "ERROR" });
      continue;
    }
    if (!row.departmentName?.trim()) {
      errors.push({ rowNumber, email: emailClean, reason: "Department name is required", severity: "ERROR" });
      continue;
    }
    if (!row.designationName?.trim()) {
      errors.push({ rowNumber, email: emailClean, reason: "Designation name is required", severity: "ERROR" });
      continue;
    }

    // ── Branch resolution — exact match only (branches are location-specific) ──
    const branchEntry = branchMap.get(normalize(row.branchName ?? ""));
    if (!branchEntry) {
      errors.push({
        rowNumber,
        email: emailClean,
        reason: `Branch "${row.branchName}" not found. Branches cannot be auto-created — please use an exact branch name.`,
        severity: "ERROR",
      });
      continue;
    }
    const branchId = new mongoose.Types.ObjectId(branchEntry.id);

    // ── Joining date validation ────────────────────────────────────────────
    const joiningDate = new Date(row.joiningDate);
    if (isNaN(joiningDate.getTime())) {
      errors.push({
        rowNumber,
        email: emailClean,
        reason: `Invalid joining date "${row.joiningDate}". Use YYYY-MM-DD format.`,
        severity: "ERROR",
      });
      continue;
    }

    // ── Department — fuzzy match OR auto-create ────────────────────────────
    const deptResult = await findOrCreateDepartment(
      tenantIdObj,
      branchId,
      userIdObj,
      row.departmentName,
      departmentMap,
      existingDeptCodes,
      createdDepts
    );

    if (deptResult.wasCreated) {
      warnings.push({
        rowNumber,
        email: emailClean,
        reason: `Department "${row.departmentName}" did not exist — auto-created as "${deptResult.name}".`,
        severity: "WARNING",
      });
    } else if (normalize(deptResult.name) !== normalize(row.departmentName)) {
      warnings.push({
        rowNumber,
        email: emailClean,
        reason: `Department "${row.departmentName}" matched to existing "${deptResult.name}".`,
        severity: "WARNING",
      });
    }

    // ── Designation — fuzzy match OR auto-create under resolved department ──
    const desigResult = await findOrCreateDesignation(
      tenantIdObj,
      branchId,
      userIdObj,
      new mongoose.Types.ObjectId(deptResult.id),
      row.designationName,
      designationMap,
      existingDesigCodes,
      createdDesigs
    );

    if (desigResult.wrongDept) {
      warnings.push({
        rowNumber,
        email: emailClean,
        reason: `Designation "${desigResult.name}" exists but belongs to a different department. It has been assigned as-is.`,
        severity: "WARNING",
      });
    } else if (desigResult.wasCreated) {
      warnings.push({
        rowNumber,
        email: emailClean,
        reason: `Designation "${row.designationName}" did not exist — auto-created as "${desigResult.name}" under "${deptResult.name}".`,
        severity: "WARNING",
      });
    } else if (normalize(desigResult.name) !== normalize(row.designationName)) {
      warnings.push({
        rowNumber,
        email: emailClean,
        reason: `Designation "${row.designationName}" matched to existing "${desigResult.name}".`,
        severity: "WARNING",
      });
    }

    // ── Statutory validations via plugin ──
    const countryCode = (row.countryCode?.trim() || "IN").toUpperCase();
    const countryModule = getCountryModule(countryCode);
    let statutoryValid = true;

    for (const field of countryModule.statutoryFields) {
      const val = (row as any)[field.key]?.trim();
      if (val) {
        const checkResult = field.validate(val);
        if (typeof checkResult === "string") {
          errors.push({
            rowNumber,
            email: emailClean,
            reason: `Invalid ${field.label} format: ${checkResult}`,
            severity: "ERROR",
          });
          statutoryValid = false;
        }
      } else if (field.required) {
        errors.push({
          rowNumber,
          email: emailClean,
          reason: `${field.label} is required for country ${countryCode}`,
          severity: "ERROR",
        });
        statutoryValid = false;
      }
    }
    if (!statutoryValid) continue;

    // ── Build employee document ────────────────────────────────────────────
    const employeeCode = await getNextEmployeeCode(context.tenantId);
    const newEmpId = new mongoose.Types.ObjectId();

    const employeeDoc = {
      _id: newEmpId,
      tenantId: tenantIdObj,
      branchId,
      departmentId: new mongoose.Types.ObjectId(deptResult.id),
      designationId: new mongoose.Types.ObjectId(desigResult.id),
      employeeCode,
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      email: emailClean,
      phone: row.phone?.trim(),
      joiningDate,
      employeeType: Object.values(EmployeeType).includes(row.employeeType as any)
        ? row.employeeType
        : EmployeeType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      gender: Object.values(Gender).includes(row.gender as any)
        ? row.gender
        : undefined,
      dateOfBirth: row.dateOfBirth && !isNaN(new Date(row.dateOfBirth).getTime())
        ? new Date(row.dateOfBirth)
        : undefined,
      pan: row.pan?.trim().toUpperCase() || undefined,
      aadhaar: row.aadhaar?.trim() || undefined,
      countryCode,
      isActive: true,
      onboardingStep: 1,
      onboardingComplete: false,
      isProfileComplete: false,
      createdBy: userIdObj,
      updatedBy: userIdObj,
    };

    validRecords.push(employeeDoc);
    existingEmails.add(emailClean); // prevent duplicate within same import file
  }

  return {
    validRecords,
    totalRows: rawRows.length,
    errors,
    warnings,
    created: {
      departments: [...new Set(createdDepts)],
      designations: [...new Set(createdDesigs)],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BUILDER
// Same columns as import template so HR can export → edit → re-import
// ─────────────────────────────────────────────────────────────────────────────

export async function buildExportBuffer(
  employees: any[],
  format: "csv" | "xlsx"
): Promise<Buffer> {

  // Column definitions — identical order for import/export symmetry
  const columns = [
    { header: "Employee Code", key: "employeeCode", width: 15 },
    { header: "First Name", key: "firstName", width: 20 },
    { header: "Last Name", key: "lastName", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Branch", key: "branch", width: 20 },
    { header: "Department", key: "department", width: 25 },
    { header: "Designation", key: "designation", width: 25 },
    { header: "Employee Type", key: "employeeType", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Joining Date", key: "joiningDate", width: 15 },
    { header: "Date of Birth", key: "dateOfBirth", width: 15 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "PAN", key: "pan", width: 15 },
    { header: "Aadhaar", key: "aadhaar", width: 15 },
  ];

  // Build row data
  const rows = employees.map(emp => ({
    employeeCode: emp.employeeCode || "",
    firstName: emp.firstName || "",
    lastName: emp.lastName || "",
    email: emp.email || "",
    phone: emp.phone || "",
    branch: emp.branchId?.name || "",
    department: emp.departmentId?.name || "",
    designation: emp.designationId?.name || "",
    employeeType: emp.employeeType || "",
    status: emp.status || "",
    joiningDate: emp.joiningDate
      ? new Date(emp.joiningDate).toISOString().split("T")[0]
      : "",
    dateOfBirth: emp.dateOfBirth
      ? new Date(emp.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: emp.gender || "",
    pan: emp.pan || "",
    aadhaar: emp.aadhaar || "",
  }));

  if (format === "csv") {
    const headerLine = columns.map(c => `"${c.header}"`).join(",");
    const dataLines = rows.map(row =>
      columns
        .map(c => `"${String((row as any)[c.key] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    return Buffer.from([headerLine, ...dataLines].join("\n"), "utf-8");
  }

  // XLSX
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Employees");

  worksheet.columns = columns;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2886CE" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  for (const row of rows) {
    worksheet.addRow(row);
  }

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT TEMPLATE GENERATOR
// HR downloads this to know exact column names and valid values
// ─────────────────────────────────────────────────────────────────────────────

export async function buildImportTemplate(format: "csv" | "xlsx"): Promise<Buffer> {
  const sampleRows = [
    {
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul.sharma@company.com",
      phone: "9876543210",
      branch: "Head Office",
      department: "Software Engineering",
      designation: "Software Engineer",
      employeeType: "FULL_TIME",
      status: "ACTIVE",
      joiningDate: "2024-01-15",
      dateOfBirth: "1995-06-20",
      gender: "MALE",
      pan: "ABCDE1234F",
      aadhaar: "123456789012",
    },
  ];

  const columns = [
    { header: "First Name", key: "firstName", width: 20 },
    { header: "Last Name", key: "lastName", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Branch", key: "branch", width: 20 },
    { header: "Department", key: "department", width: 25 },
    { header: "Designation", key: "designation", width: 25 },
    { header: "Employee Type", key: "employeeType", width: 15 },
    { header: "Joining Date", key: "joiningDate", width: 15 },
    { header: "Date of Birth", key: "dateOfBirth", width: 15 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "PAN", key: "pan", width: 15 },
    { header: "Aadhaar", key: "aadhaar", width: 15 },
  ];

  if (format === "csv") {
    const header = columns.map(c => `"${c.header}"`).join(",");
    const sample = columns
      .map(c => `"${(sampleRows[0] as any)[c.key] ?? ""}"`)
      .join(",");
    return Buffer.from([header, sample].join("\n"), "utf-8");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Import Template");
  worksheet.columns = columns;

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2886CE" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  worksheet.addRow(sampleRows[0]);

  // Notes sheet — valid values for enum fields
  const notes = workbook.addWorksheet("Valid Values");
  notes.addRow(["Field", "Valid Values"]);
  notes.addRow(["Employee Type", "FULL_TIME, PART_TIME, CONTRACT, INTERN, CONSULTANT"]);
  notes.addRow(["Gender", "MALE, FEMALE, OTHER"]);
  notes.addRow(["Joining Date", "YYYY-MM-DD format e.g. 2024-01-15"]);
  notes.addRow(["Date of Birth", "YYYY-MM-DD format e.g. 1995-06-20"]);
  notes.addRow(["Department", "Exact name or close match — auto-created if not found"]);
  notes.addRow(["Designation", "Exact name or close match — auto-created if not found"]);
  notes.addRow(["Branch", "Must match exact branch name — cannot be auto-created"]);
  notes.addRow(["PAN", "10-character PAN e.g. ABCDE1234F"]);
  notes.addRow(["Aadhaar", "12-digit Aadhaar number"]);

  notes.getRow(1).font = { bold: true };
  notes.columns = [{ width: 20 }, { width: 60 }];

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────────────────────────────────────

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
          email: data.email || data["Email"] || data["Email Address"],
          phone: data.phone || data["Phone"] || data["Phone Number"],
          branchName: data.branchName || data.branch || data["Branch"],
          departmentName: data.departmentName || data.department || data["Department"],
          designationName: data.designationName || data.designation || data["Designation"],
          joiningDate: data.joiningDate || data.joining_date || data["Joining Date"],
          employeeType: data.employeeType || data.employee_type || data["Employee Type"],
          gender: data.gender || data["Gender"],
          dateOfBirth: data.dateOfBirth || data.dob || data["Date of Birth"],
          pan: data.pan || data["PAN"],
          aadhaar: data.aadhaar || data["Aadhaar"],
          countryCode: data.countryCode || data.country || data["Country"] || data["Country Code"],
        });
      })
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL PARSER
// ─────────────────────────────────────────────────────────────────────────────

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

    // Skip fully empty rows
    const hasData = values.some(v => v !== null && v !== undefined && v !== "");
    if (!hasData) return;

    const rowObj: any = {};
    headers.forEach((header, index) => {
      if (header) rowObj[header] = values[index];
    });

    results.push({
      firstName: rowObj["first name"] || rowObj["firstname"] || rowObj["first_name"],
      lastName: rowObj["last name"] || rowObj["lastname"] || rowObj["last_name"],
      email: rowObj["email"] || rowObj["email address"],
      phone: rowObj["phone"] || rowObj["phone number"],
      branchName: rowObj["branch"],
      departmentName: rowObj["department"],
      designationName: rowObj["designation"],
      joiningDate: rowObj["joining date"] || rowObj["joiningdate"] || rowObj["joining_date"],
      employeeType: rowObj["employee type"] || rowObj["employeetype"] || rowObj["employee_type"],
      gender: rowObj["gender"],
      dateOfBirth: rowObj["date of birth"] || rowObj["dateofbirth"] || rowObj["dob"],
      pan: rowObj["pan"],
      aadhaar: rowObj["aadhaar"],
      countryCode: rowObj["country code"] || rowObj["countrycode"] || rowObj["country"] || rowObj["country_code"],
    });
  });

  return results;
}
