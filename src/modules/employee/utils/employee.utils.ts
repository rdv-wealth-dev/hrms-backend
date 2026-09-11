import mongoose from "mongoose";
import csvParser from "csv-parser";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeModel, EmployeeStatus, EmployeeType, Gender, BloodGroup, MaritalStatus, QualificationLevel, Religion } from "../models/employee.model";
import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";
import { BranchModel } from "../../branch/branch.model";
import { OrganizationModel } from "../../organization/organization.model";
import { CustomFieldModel } from "../../custom-field/custom-field.model";
import { UserModel } from "../../user/user.model";
import { getNextEmployeeCode, getNextBatchEmployeeCodes } from "./employee-counter.util";
import { getCountryModule } from "../../../domain/localization/country.registry";

// TYPES

export interface BulkImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  branchName: string;
  departmentName: string;
  subDepartmentName?: string;
  designationName: string;
  workMode?: string;
  grade?: string;
  joiningDate: string;
  employeeType?: string;
  gender?: string;
  dateOfBirth?: string;
  pan?: string;
  aadhaar?: string;
  countryCode?: string;
  preservedEmployeeCode?: string;   // from sheet, if exists
  // Extended fields
  bloodGroup?: string;
  maritalStatus?: string;
  religion?: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  spouseName?: string;
  spousePhone?: string;
  highestQualification?: string;
  previousEmployerName?: string;
  exitDate?: string;
  exitReason?: string;
  importedStatus?: string;
  reportingManagerName?: string;
  nationality?: string;
  passportNo?: string;
  // Sub-docs packed in by Layer 3
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountType?: string;
  };
  currentAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryCode?: string;
  };
  permanentAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryCode?: string;
  };
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  educationDetails?: Array<{
    qualificationLevel: string;
    degree?: string;
    institutionName?: string;
    yearOfPassing?: number;
  }>;
  customFields?: Record<string, any>;
  [key: string]: any;
}

export interface ImportError {
  rowNumber: number;
  email?: string;
  reason: string;
  severity: "ERROR" | "WARNING";
}

export interface ParsedImportData {
  validRecords: any[];
  totalRows: number;
  errors: ImportError[];
  warnings: ImportError[];
  created: {
    departments: string[];
    designations: string[];
  };
}

// LAYER 1: SMART HEADER MAP
// Maps every possible human-written column header → canonical key
// Handles: case differences, spaces, abbreviations, Hindi-English mix, typos

const HEADER_SYNONYM_MAP: Record<string, string> = {
  // ── Name
  "first name": "firstName", "firstname": "firstName", "first_name": "firstName",
  "fname": "firstName", "given name": "firstName",
  "last name": "lastName", "lastname": "lastName", "last_name": "lastName",
  "lname": "lastName", "surname": "lastName", "family name": "lastName",
  "employee name": "fullName", "employeename": "fullName", "name": "fullName",
  "full name": "fullName", "fullname": "fullName", "staff name": "fullName",
  "worker name": "fullName", "emp name": "fullName",

  // ── Email (priority: new mail > official > personal)
  "new mail id": "email2",       // highest priority
  "new mail": "email2",
  "official mail id": "email1",  // second priority
  "official mail": "email1",
  "official email": "email1",
  "work email": "email1",
  "company email": "email1",
  "corporate email": "email1",
  "email": "email0",             // standard key
  "email address": "email0",
  "mail": "email0",
  "e mail": "email0",
  "personal mail id": "email3",  // lowest priority
  "personal mail": "email3",
  "personal email": "email3",

  // ── Phone
  "phone": "phone", "phone number": "phone", "phonenumber": "phone",
  "phone no": "phone", "phone no.": "phone",
  "mobile": "phone", "mobile no": "phone", "mobile number": "phone",
  "mobile no.": "phone", "cell": "phone", "cell number": "phone",
  "contact": "phone", "contact number": "phone", "contact no": "phone",
  "whatsapp": "phone",

  // ── Employee Code
  "emp code": "employeeCode", "employee code": "employeeCode",
  "employeecode": "employeeCode", "emp id": "employeeCode",
  "employee id": "employeeCode", "staff id": "employeeCode",
  "staff code": "employeeCode", "empcode": "employeeCode",
  "worker id": "employeeCode", "id": "employeeCode",

  // ── Branch / Office
  "branch": "branchName", "branch name": "branchName", "branchname": "branchName",
  "location": "branchName", "office": "branchName", "office location": "branchName",
  "work location": "branchName", "site": "branchName",
  "plant": "branchName", "unit": "branchName",

  // ── Organization (company name, not branch)
  "org name": "organizationName", "orgname": "organizationName", "organization": "organizationName",
  "company": "organizationName", "company name": "organizationName",

  // ── Department
  "department": "departmentName", "dept": "departmentName",
  "department name": "departmentName", "departmentname": "departmentName",
  "dept name": "departmentName", "division": "departmentName",
  "section": "departmentName", "team": "departmentName",

  // ── Designation / Role
  "designation": "designationName", "designation name": "designationName",
  "designationname": "designationName", "job title": "designationName",
  "title": "designationName", "position": "designationName",
  "role": "designationName", "post": "designationName",
  "grade": "designationName", "rank": "designationName",
  "job role": "designationName",

  // ── Reporting Manager
  "reporting manager": "reportingManagerName", "reporting manager name": "reportingManagerName",
  "reporting to": "reportingManagerName", "reports to": "reportingManagerName",
  "manager": "reportingManagerName", "manager name": "reportingManagerName",
  "rm": "reportingManagerName", "tl": "reportingManagerName",
  "team leader": "reportingManagerName", "lead": "reportingManagerName",

  // ── Employee Type
  "employee type": "employeeType", "employeetype": "employeeType",
  "employment type": "employeeType", "employmenttype": "employeeType",
  "emp type": "employeeType", "type of employment": "employeeType",
  "contract type": "employeeType",

  // ── Status
  "status": "importedStatus", "employee status": "importedStatus",
  "employment status": "importedStatus", "emp status": "importedStatus",
  "active status": "importedStatus",

  // ── Joining Date
  "joining date": "joiningDate", "joiningdate": "joiningDate",
  "joining_date": "joiningDate", "doj": "joiningDate",
  "date of joining": "joiningDate", "date of join": "joiningDate",
  "join date": "joiningDate", "start date": "joiningDate",
  "date of commencement": "joiningDate", "commencement date": "joiningDate",
  "hire date": "joiningDate", "hired date": "joiningDate",

  // ── Date of Birth
  "date of birth": "dateOfBirth", "dateofbirth": "dateOfBirth",
  "dob": "dateOfBirth", "birth date": "dateOfBirth",
  "dob (official)": "dateOfBirth", "dob official": "dateOfBirth",
  "birthday": "dateOfBirth",

  // ── Gender
  "gender": "gender", "sex": "gender",

  // ── Blood Group
  "blood group": "bloodGroup", "bloodgroup": "bloodGroup",
  "blood grp": "bloodGroup", "blood type": "bloodGroup",
  "bld grp": "bloodGroup",

  // ── Marital Status
  "marital status": "maritalStatus", "maritalstatus": "maritalStatus",
  "marital": "maritalStatus", "married status": "maritalStatus",

  // ── Country
  "country": "countryCode", "country code": "countryCode",
  "countrycode": "countryCode", "country_code": "countryCode",
  "nationality": "nationality",

  // ── PAN
  "pan": "pan", "pan card no": "pan", "pan card": "pan",
  "pan no": "pan", "pan number": "pan",
  "pan card no.": "pan",

  // ── Aadhaar
  "aadhaar": "aadhaar", "aadhar": "aadhaar", "adhar": "aadhaar",
  "aadhaar no": "aadhaar", "aadhar no": "aadhaar",
  "aadhaar number": "aadhaar", "aadhar card no.": "aadhaar",
  "aadhar card no": "aadhaar", "uid": "aadhaar",

  // ── Passport
  "passport": "passportNo", "passport no": "passportNo",
  "passport number": "passportNo", "passportno": "passportNo",

  // ── Bank Account
  "account number": "accountNumber", "account no": "accountNumber",
  "account no.": "accountNumber", "acc no": "accountNumber",
  "acc number": "accountNumber", "bank account": "accountNumber",
  "bank account number": "accountNumber", "bank acc no": "accountNumber",
  "ifsc": "ifscCode", "ifsc code": "ifscCode", "ifsccode": "ifscCode",
  "bank ifsc": "ifscCode", "rtgs code": "ifscCode",
  "bank name": "bankName", "bank": "bankName",

  // ── Address
  "address": "currentAddressLine1", "current address": "currentAddressLine1",
  "current address line 1": "currentAddressLine1",
  "permanent address": "permanentAddressLine1",
  "home address": "permanentAddressLine1",
  "city": "currentCity", "current city": "currentCity",
  "state": "currentState", "current state": "currentState",
  "pin": "currentZip", "pin code": "currentZip", "pincode": "currentZip",
  "zip": "currentZip", "zip code": "currentZip",

  // ── Family / Emergency Contacts
  "father name": "fatherName", "father's name": "fatherName",
  "fathers name": "fatherName", "father": "fatherName",
  "father contact": "fatherPhone", "father phone": "fatherPhone",
  "father's phone": "fatherPhone", "father mobile": "fatherPhone",
  "mother name": "motherName", "mother's name": "motherName",
  "mothers name": "motherName", "mother": "motherName",
  "mother contact": "motherPhone", "mother phone": "motherPhone",
  "mother's phone": "motherPhone",
  "spouse name": "spouseName", "spouse's name": "spouseName",
  "husband name": "spouseName", "wife name": "spouseName",
  "spouse phone": "spousePhone", "spouse contact": "spousePhone",

  // ── Education
  "highest education": "highestQualification",
  "highest qualification": "highestQualification",
  "qualification": "highestQualification",
  "education": "highestQualification",
  "highest degree": "highestQualification",
  "educational qualification": "highestQualification",

  // ── Previous Employer
  "previous employer": "previousEmployerName",
  "previous employer name": "previousEmployerName",
  "last employer": "previousEmployerName",
  "ex employer": "previousEmployerName",
  "previous company": "previousEmployerName",
  "last company": "previousEmployerName",

  // ── Exit
  "lwd": "exitDate", "last working day": "exitDate",
  "last working date": "exitDate", "date of resignation": "exitDate",
  "exit date": "exitDate", "leaving date": "exitDate",
  "date of leaving": "exitDate",
  "reason for leaving": "exitReason", "exit reason": "exitReason",
  "resignation reason": "exitReason", "reason of leaving": "exitReason",
  "reason of resignation": "exitReason",
  "termination reason": "exitReason",
  "resignation type": "resignationType", "resignation type(vol/invol)": "resignationType",

  // ── Work Mode & Skype
  "wfh/office": "workMode", "wfh office": "workMode", "wfo/wfh": "workMode",
  "work mode": "workMode", "wfh": "workMode", "wfo": "workMode",
  "skype id": "skypeId", "skype": "skypeId",

  // ── CTC / Compensation
  "ctc (pa)": "ctcPa", "ctc pa": "ctcPa", "ctc annual": "ctcPa", "annual ctc": "ctcPa",
  "ctc (pm)": "ctcPm", "ctc pm": "ctcPm", "ctc monthly": "ctcPm", "monthly ctc": "ctcPm",

  // ── Actual DOB & Religion & Anniversary
  "dob(actual)": "dobActual", "dob actual": "dobActual", "actual dob": "dobActual",
  "religion": "religion",
  "date of anniversary": "anniversaryDate", "anniversary date": "anniversaryDate", "anniversary": "anniversaryDate",
  "children": "children", "child": "children", "no of children": "children",

  // ── Alternate Phone & Secondary Bank
  "alternate contact no.": "alternatePhone", "alternate contact no": "alternatePhone",
  "alternate contact": "alternatePhone", "alternate phone": "alternatePhone",
  "alternate mobile": "alternatePhone", "alt phone": "alternatePhone",
  "icici account number": "secondaryAccountNumber", "secondary account number": "secondaryAccountNumber",
  "secondary account": "secondaryAccountNumber", "secondary ifsc code": "secondaryIfscCode",
  "secondary ifsc": "secondaryIfscCode",

  // ── Statutory
  "uan no.": "uanNo", "uan no": "uanNo", "uan number": "uanNo", "uan": "uanNo",
  "esic no.": "esicNo", "esic no": "esicNo", "esic number": "esicNo", "esic": "esicNo",

  // ── Organization & Hiring Details
  "sub department": "subDepartment", "sub dept": "subDepartment", "subdepartment": "subDepartment",
  "source/reference of hiring": "hiringSource", "source of hiring": "hiringSource",
  "reference of hiring": "hiringSource", "hiring source": "hiringSource",
  "source/reference name": "hiringReferrer", "reference name": "hiringReferrer", "referrer name": "hiringReferrer",
  "documentation done (yes/no)": "documentationDone", "documentation done": "documentationDone",

  "remarks": "remarks", "remark": "remarks",
};

// ─────────────────────────────────────────────────────────────────
// FUZZY MATCHING & NORMALIZATION ENGINE
// ─────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_HEADER_SYNONYMS: Record<string, string> = {};
for (const [k, v] of Object.entries(HEADER_SYNONYM_MAP)) {
  NORMALIZED_HEADER_SYNONYMS[normalize(k)] = v;
}

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

function fuzzyMatch(
  input: string,
  nameMap: Map<string, any>
): { id: any; matchedName: string; exact: boolean } | null {
  const normalizedInput = normalize(input);
  if (nameMap.has(normalizedInput)) {
    return { id: nameMap.get(normalizedInput).id, matchedName: nameMap.get(normalizedInput).name, exact: true };
  }
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

function buildNameMap(docs: { _id: any; name: string }[]): Map<string, { id: any; name: string }> {
  const map = new Map<string, { id: any; name: string }>();
  for (const doc of docs) {
    map.set(normalize(doc.name), { id: doc._id, name: doc.name });
  }
  return map;
}

function generateCode(name: string, existingCodes: Set<string>): string {
  const words = name.trim().toUpperCase().split(/\s+/);
  let base: string;
  if (words.length === 1) {
    base = words[0].slice(0, 8);
  } else {
    base = words.map(w => w.slice(0, 3)).join("-").slice(0, 20);
  }
  let code = base;
  let counter = 2;
  while (existingCodes.has(code)) {
    code = `${base}-${counter}`;
    counter++;
  }
  existingCodes.add(code);
  return code;
}

function normalizeWorkMode(val: any): string {
  if (!val) return "OFFICE";
  const s = String(val).trim().toUpperCase();
  if (["WFO", "OFFICE", "WORK FROM OFFICE", "O"].includes(s)) return "OFFICE";
  if (["WFH", "REMOTE", "WORK FROM HOME", "HOME", "H"].includes(s)) return "WFH";
  if (s === "HYBRID") return "HYBRID";
  return "OFFICE";
}

async function findOrCreateDepartment(
  tenantId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  name: string,
  nameMap: Map<string, { id: any; name: string }>,
  existingCodes: Set<string>,
  createdNames: string[],
  parentId?: mongoose.Types.ObjectId
): Promise<{ id: any; name: string; wasCreated: boolean }> {
  const norm = normalize(name);
  if (nameMap.has(norm)) {
    return { id: nameMap.get(norm)!.id, name: nameMap.get(norm)!.name, wasCreated: false };
  }

  const code = generateCode(name, existingCodes);
  const cleanName = name.trim();
  const newDept = await DepartmentModel.create({
    tenantId, branchId, name: cleanName, code,
    description: `Auto-created during bulk employee import`,
    parentId: parentId || null,
    isActive: true, createdBy: userId, updatedBy: userId,
  });
  const { invalidateMasterDataCache } = require("./master-data-cache");
  invalidateMasterDataCache(tenantId.toString());
  nameMap.set(norm, { id: newDept._id, name: cleanName });
  createdNames.push(cleanName);
  return { id: newDept._id, name: cleanName, wasCreated: true };
}

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

  // 1. Exact match within this department
  for (const [key, value] of nameMap.entries()) {
    if (value.departmentId?.toString() === departmentId.toString() && key === normalizedInput) {
      return { id: value.id, name: value.name, wasCreated: false, wrongDept: false };
    }
  }

  // 2. Exact match across tenant
  const exactEntry = nameMap.get(normalizedInput);
  if (exactEntry) {
    return { id: exactEntry.id, name: exactEntry.name, wasCreated: false, wrongDept: false };
  }

  // 3. Exact matching only — NO cross-department fuzzy guessing!
  // If not found, CREATE IT exactly as written in the sheet under the employee's department!
  const code = generateCode(name, existingCodes);
  const cleanName = name.trim();
  const newDesig = await DesignationModel.create({
    tenantId, branchId, departmentId, name: cleanName, code,
    description: `Auto-created during bulk employee import`,
    level: 1, isActive: true, createdBy: userId, updatedBy: userId,
  });
  const { invalidateMasterDataCache } = require("./master-data-cache");
  invalidateMasterDataCache(tenantId.toString());
  nameMap.set(normalizedInput, { id: newDesig._id, name: cleanName, departmentId });
  createdNames.push(cleanName);
  return { id: newDesig._id, name: cleanName, wasCreated: true, wrongDept: false };
}

// ─────────────────────────────────────────────────────────────────
// LAYER 1: SMART HEADER DETECTION
// Maps any raw header → canonical field key
// Falls back to fuzzy Levenshtein if exact synonym not found
// ─────────────────────────────────────────────────────────────────

/**
 * Build a {rawHeader → canonicalKey} map by running every sheet header
 * through the synonym dictionary first, then fuzzy fallback.
 */
function mapHeaders(rawHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const raw of rawHeaders) {
    if (!raw || !raw.trim()) continue;

    const normRaw = normalize(raw);
    const stripped = raw.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const normStripped = normalize(stripped);

    // 1. Direct exact lookup on original full header first (so "DOB (OFFICIAL)" vs "DOB(Actual)", "CTC (PA)" vs "CTC (PM)" don't collide)
    if (NORMALIZED_HEADER_SYNONYMS[normRaw]) {
      mapping[raw] = NORMALIZED_HEADER_SYNONYMS[normRaw];
      continue;
    }

    // 2. Direct exact lookup on stripped parenthetical header (e.g. "Emp Code(YYYYMMDD...)" -> "emp code")
    if (NORMALIZED_HEADER_SYNONYMS[normStripped]) {
      mapping[raw] = NORMALIZED_HEADER_SYNONYMS[normStripped];
      continue;
    }

    // 3. Safe prefix check for specific known prefixes ONLY (Emp Code / Employee Code)
    if (normStripped.startsWith("emp code") || normStripped.startsWith("employee code") || normStripped.startsWith("staff code")) {
      mapping[raw] = "employeeCode";
      continue;
    }

    // 4. Fallback: custom field
    mapping[raw] = `__custom__${normStripped.replace(/\s+/g, "_")}`;
  }

  return mapping;
}

/**
 * Apply header mapping to a raw row object.
 * Returns a new object keyed by canonical names.
 */
function applyHeaderMapping(rawRow: Record<string, any>, headerMap: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const canonical = headerMap[rawKey] || `__custom__${normalize(rawKey).replace(/\s+/g, "_")}`;
    // For email priority — store all variants; we pick best later
    if (["email0", "email1", "email2", "email3"].includes(canonical)) {
      mapped[canonical] = value;
    } else if (canonical.startsWith("__custom__")) {
      if (!mapped.__customFields) mapped.__customFields = {};
      mapped.__customFields[rawKey] = value;
    } else {
      mapped[canonical] = value;
    }
  }
  return mapped;
}

// ─────────────────────────────────────────────────────────────────
// LAYER 2: UNIVERSAL DATA NORMALIZER
// ─────────────────────────────────────────────────────────────────

/**
 * Splits "Arpit Jain" → {firstName:"Arpit", lastName:"Jain"}
 * "Mohammad Ali Khan" → {firstName:"Mohammad", lastName:"Ali Khan"}
 * Single word "Rahul" → {firstName:"Rahul", lastName:""}
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Parses virtually any date format into a Date object.
 * Handles:
 *   - "Monday, August 13, 2012"   (long date)
 *   - "11-Feb-89" / "11-Feb-1989" (short month name)
 *   - "13/08/2012" / "08/13/2012" (dd/mm/yyyy or mm/dd/yyyy)
 *   - "2012-08-13"                (ISO standard)
 *   - "11 Feb 1989"               (space-separated)
 *   - 44927                       (Excel serial number)
 *   - "89" year → assumes 19xx
 */
function parseAnyDate(val: any): Date | null {
  if (!val && val !== 0) return null;

  // Excel serial number (number, typically > 25000 and < 55000)
  if (typeof val === "number") {
    if (val > 25000 && val < 60000) {
      // Excel date serial: days since Jan 1 1900, with leap year bug
      const excelEpoch = new Date(1899, 11, 30);
      const result = new Date(excelEpoch.getTime() + val * 86400000);
      return isNaN(result.getTime()) ? null : result;
    }
    return null;
  }

  const str = String(val).trim();
  if (!str || str.toLowerCase() === "n/a" || str.toLowerCase() === "na" || str === "-") return null;

  // Strip day-of-week prefix: "Monday, August 13, 2012" → "August 13, 2012"
  const withoutDOW = str.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, "");

  // Month name map
  const MONTHS: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };

  // Pattern: "11-Feb-89", "11-Feb-1989", "11 Feb 1989", "Aug 13 2012"
  const monthNamePattern = /^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{2,4})$/;
  const monthNamePattern2 = /^([A-Za-z]{3,9})[\s\-](\d{1,2})[\s\-,]?\s*(\d{2,4})$/;

  let m = withoutDOW.match(monthNamePattern);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthIdx = MONTHS[m[2].toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    if (monthIdx !== undefined) {
      const d = new Date(year, monthIdx, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  m = withoutDOW.match(monthNamePattern2);
  if (m) {
    const monthIdx = MONTHS[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    if (monthIdx !== undefined) {
      const d = new Date(year, monthIdx, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Pattern: dd/mm/yyyy or mm/dd/yyyy or dd-mm-yyyy
  const numericPattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/;
  m = str.match(numericPattern);
  if (m) {
    let [, p1, p2, p3] = m;
    let year = parseInt(p3, 10);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    // If p1 > 12, it must be day
    const n1 = parseInt(p1, 10), n2 = parseInt(p2, 10);
    let day: number, month: number;
    if (n1 > 12) { day = n1; month = n2; }       // dd/mm/yyyy
    else if (n2 > 12) { day = n2; month = n1; }  // mm/dd/yyyy
    else { day = n1; month = n2; }                // assume dd/mm
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO and other standard formats — native parse
  const nativeParsed = new Date(withoutDOW);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  return null;
}

/**
 * Cleans a number stored in Excel scientific notation.
 * "6.66E+11" → "666000000000"
 * Forces exactly `targetDigits` digits with zero-padding on the right if shorter.
 */
function cleanScientificNumber(val: any, targetDigits: number): string | null {
  if (!val && val !== 0) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Handle Excel scientific: 6.66E+11
  if (/^[\d.]+[eE][+\-]\d+$/.test(str)) {
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    // Convert to integer string without scientific notation
    const full = Math.round(num).toString();
    // Pad with zeros on right if shorter than targetDigits (e.g. 6.66E+11 → 666000000000)
    return full.padEnd(targetDigits, "0").slice(0, targetDigits);
  }

  // Already a plain number string — strip spaces and non-digits
  const cleaned = str.replace(/[\s\-]/g, "");
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(targetDigits, "0").slice(-targetDigits);
  }

  return cleaned; // return as-is if can't clean
}

/**
 * Cleans phone number: strips country code (+91, 0), spaces, dashes.
 * Returns 10-digit string for India, or cleaned number for others.
 */
function cleanPhone(val: any): string | null {
  if (!val) return null;
  let str = String(val).trim().replace(/[\s\-\(\)\.]/g, "");
  // Strip leading +91 or 91 for India
  if (str.startsWith("+91")) str = str.slice(3);
  else if (str.startsWith("91") && str.length === 12) str = str.slice(2);
  else if (str.startsWith("0") && str.length === 11) str = str.slice(1);
  // Keep only digits
  str = str.replace(/\D/g, "");
  return str || null;
}

/**
 * Normalizes gender strings: M/F/Male/Female/male/female → enum value
 */
function normalizeGender(val: any): string | undefined {
  if (!val) return undefined;
  const s = String(val).trim().toLowerCase();
  if (s === "m" || s === "male" || s === "masculine") return Gender.MALE;
  if (s === "f" || s === "female" || s === "feminine") return Gender.FEMALE;
  if (s === "other" || s === "o" || s === "non-binary" || s === "nonbinary") return Gender.OTHER;
  return undefined;
}

/**
 * Normalizes employee type: permanent/regular/full time → FULL_TIME etc.
 */
function normalizeEmployeeType(val: any): string {
  if (!val) return EmployeeType.FULL_TIME;
  const s = normalize(String(val));
  if (["full time", "fulltime", "permanent", "regular", "confirmed", "full_time"].includes(s)) return EmployeeType.FULL_TIME;
  if (["part time", "parttime", "part_time"].includes(s)) return EmployeeType.PART_TIME;
  if (["contract", "contractor", "contractual", "temporary", "temp"].includes(s)) return EmployeeType.CONTRACT;
  if (["intern", "internship", "trainee", "apprentice"].includes(s)) return EmployeeType.INTERN;
  if (["consultant", "freelancer", "freelance", "advisor"].includes(s)) return EmployeeType.CONSULTANT;
  // Try direct enum match
  const upper = String(val).trim().toUpperCase().replace(/ /g, "_");
  if (Object.values(EmployeeType).includes(upper as any)) return upper;
  return EmployeeType.FULL_TIME;
}

/**
 * Normalizes employee status: Active/InActive/Resigned/Terminated → EmployeeStatus enum
 */
function normalizeEmployeeStatus(val: any): string {
  if (!val) return EmployeeStatus.ACTIVE;
  const s = normalize(String(val));
  if (["active", "working", "present", "current", "a"].includes(s)) return EmployeeStatus.ACTIVE;
  if (["inactive", "in active", "in-active", "not active", "suspended"].includes(s)) return EmployeeStatus.INACTIVE;
  if (["resigned", "resignation", "voluntarily left", "voluntary"].includes(s)) return EmployeeStatus.RESIGNED;
  if (["terminated", "termination", "dismissed", "fired", "relieved"].includes(s)) return EmployeeStatus.TERMINATED;
  if (["on leave", "on_leave", "leave"].includes(s)) return EmployeeStatus.ON_LEAVE;
  const upper = String(val).trim().toUpperCase().replace(/ /g, "_");
  if (Object.values(EmployeeStatus).includes(upper as any)) return upper;
  return EmployeeStatus.ACTIVE;
}

/**
 * Normalizes blood group: O+, B Positive, a negative → enum value
 */
function normalizeBloodGroup(val: any): string | undefined {
  if (!val) return undefined;
  const s = String(val).trim().toUpperCase()
    .replace(/\s+/g, "")
    .replace("POSITIVE", "+").replace("POS", "+").replace("PLUS", "+")
    .replace("NEGATIVE", "-").replace("NEG", "-").replace("MINUS", "-");
  const valid = Object.values(BloodGroup);
  if (valid.includes(s as any)) return s;
  return undefined;
}

/**
 * Normalizes marital status
 */
function normalizeMaritalStatus(val: any): string | undefined {
  if (!val) return undefined;
  const s = normalize(String(val));
  if (["single", "unmarried", "bachelor", "bachelorette"].includes(s)) return MaritalStatus.SINGLE;
  if (["married", "wedded", "spouse", "w"].includes(s)) return MaritalStatus.MARRIED;
  if (["divorced", "separated", "d"].includes(s)) return MaritalStatus.DIVORCED;
  if (["widowed", "widow", "widower"].includes(s)) return MaritalStatus.WIDOWED;
  const upper = String(val).trim().toUpperCase();
  if (Object.values(MaritalStatus).includes(upper as any)) return upper;
  return undefined;
}

/**
 * Normalizes religion
 */
function normalizeReligion(val: any): string | undefined {
  if (!val) return undefined;
  const s = normalize(String(val));
  if (s.includes("hindu")) return Religion.HINDUISM;
  if (s.includes("islam") || s.includes("muslim") || s.includes("bohra")) return Religion.ISLAM;
  if (s.includes("christian")) return Religion.CHRISTIANITY;
  if (s.includes("sikh") || s.includes("punjabi")) return Religion.SIKHISM;
  if (s.includes("buddh")) return Religion.BUDDHISM;
  if (s.includes("jain")) return Religion.JAINISM;
  const upper = String(val).trim().toUpperCase();
  if (Object.values(Religion).includes(upper as any)) return upper;
  return Religion.OTHER;
}

/**
 * Normalizes highest qualification
 */
function normalizeQualification(val: any): string | undefined {
  if (!val) return undefined;
  const s = normalize(String(val));
  if (["phd", "doctorate", "ph d", "doctor of philosophy"].includes(s)) return QualificationLevel.DOCTORATE;
  if (["post graduate", "postgraduate", "pg", "mba", "msc", "mca", "mtech", "ma", "mcom", "masters", "master"].includes(s)) return QualificationLevel.POST_GRADUATE;
  if (["graduate", "under graduate", "undergraduate", "ug", "btech", "bsc", "bca", "bcom", "ba", "be", "bba", "bachelor", "bachelors", "degree"].includes(s)) return QualificationLevel.UNDER_GRADUATE;
  if (["diploma", "polytechnic", "poly"].includes(s)) return QualificationLevel.DIPLOMA;
  if (["higher secondary", "hsc", "12th", "12", "intermediate", "puc", "plus two", "class 12"].includes(s)) return QualificationLevel.HIGHER_SECONDARY;
  if (["secondary", "ssc", "10th", "10", "matriculation", "matric", "class 10"].includes(s)) return QualificationLevel.SECONDARY;
  const upper = String(val).trim().toUpperCase().replace(/ /g, "_");
  if (Object.values(QualificationLevel).includes(upper as any)) return upper;
  return QualificationLevel.OTHER;
}

/**
 * Picks the best email from a row with multiple email priority slots.
 * Priority: email2 (new mail) > email1 (official) > email0 (email) > email3 (personal)
 */
function pickBestEmail(mapped: Record<string, any>): string | null {
  const candidates = [
    mapped["email2"],  // new mail id (highest priority)
    mapped["email1"],  // official mail id
    mapped["email0"],  // email column
    mapped["email3"],  // personal mail (lowest)
    mapped["email"],   // fallback
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim().toLowerCase();
    if (s && s.includes("@") && s.includes(".")) return s;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// LAYER 3: EXTENDED FIELD EXTRACTOR
// Extracts sub-document data from mapped row
// ─────────────────────────────────────────────────────────────────

function extractBankAccount(mapped: Record<string, any>): BulkImportRow["bankAccount"] | undefined {
  const accountNumber = cleanScientificNumber(mapped.accountNumber, 18);
  const ifscCode = String(mapped.ifscCode ?? "").trim().toUpperCase();
  const bankName = String(mapped.bankName ?? "").trim();

  if (!accountNumber || !ifscCode || ifscCode.length < 4) return undefined;

  return {
    bankName: bankName || "Unknown Bank",
    accountNumber,
    ifscCode,
    accountType: "SALARY",
  };
}

function extractCurrentAddress(mapped: Record<string, any>): BulkImportRow["currentAddress"] | undefined {
  const line1 = String(mapped.currentAddressLine1 ?? mapped.currentAddress ?? mapped.address ?? "").trim();
  let city = String(mapped.currentCity ?? mapped.city ?? "").trim();
  let state = String(mapped.currentState ?? mapped.state ?? "").trim();
  let zip = String(mapped.currentZip ?? mapped.zip ?? "").trim();
  if (!line1 && !city && !state) return undefined;

  if (line1 && (!city || !zip)) {
    const pinMatch = line1.match(/\b(\d{6})\b/);
    if (pinMatch && !zip) zip = pinMatch[1];
    if (!city) {
      const parts = line1.split(",").map(s => s.trim()).filter(Boolean);
      city = parts.length > 1 ? parts[parts.length - (pinMatch ? 2 : 1)].replace(/\d+/g, "").trim() : "Indore";
    }
  }

  return {
    addressLine1: line1 || city || "Indore",
    city: city || "Indore",
    state: state || "Madhya Pradesh",
    zip: zip || "452001",
    countryCode: "IN",
  };
}

function extractPermanentAddress(mapped: Record<string, any>): BulkImportRow["permanentAddress"] | undefined {
  const line1 = String(mapped.permanentAddressLine1 ?? mapped.permanentAddress ?? "").trim();
  let city = String(mapped.permanentCity ?? mapped.city ?? "").trim();
  let state = String(mapped.permanentState ?? mapped.state ?? "").trim();
  let zip = String(mapped.permanentZip ?? mapped.zip ?? "").trim();
  if (!line1 && !city && !state) return undefined;

  if (line1 && (!city || !zip)) {
    const pinMatch = line1.match(/\b(\d{6})\b/);
    if (pinMatch && !zip) zip = pinMatch[1];
    if (!city) {
      const parts = line1.split(",").map(s => s.trim()).filter(Boolean);
      city = parts.length > 1 ? parts[parts.length - (pinMatch ? 2 : 1)].replace(/\d+/g, "").trim() : "Indore";
    }
  }

  return {
    addressLine1: line1 || city || "Indore",
    city: city || "Indore",
    state: state || "Madhya Pradesh",
    zip: zip || "452001",
    countryCode: "IN",
  };
}

function extractEmergencyContacts(mapped: Record<string, any>): BulkImportRow["emergencyContacts"] {
  const contacts: NonNullable<BulkImportRow["emergencyContacts"]> = [];
  if (mapped.fatherName?.toString().trim()) {
    const phone = cleanPhone(mapped.fatherPhone);
    contacts.push({
      name: String(mapped.fatherName).trim(),
      relationship: "Father",
      phone: phone || "0000000000",
    });
  }
  if (mapped.motherName?.toString().trim()) {
    const phone = cleanPhone(mapped.motherPhone);
    contacts.push({
      name: String(mapped.motherName).trim(),
      relationship: "Mother",
      phone: phone || "0000000000",
    });
  }
  if (mapped.spouseName?.toString().trim()) {
    const phone = cleanPhone(mapped.spousePhone);
    contacts.push({
      name: String(mapped.spouseName).trim(),
      relationship: "Spouse",
      phone: phone || "0000000000",
    });
  }
  return contacts.length ? contacts : undefined as any;
}

function extractEducationDetails(mapped: Record<string, any>): BulkImportRow["educationDetails"] {
  const qual = normalizeQualification(mapped.highestQualification);
  if (!qual) return undefined;
  const deg = String(mapped.degree ?? mapped.highestQualification ?? "").trim() || qual;
  const inst = String(mapped.institutionName ?? mapped.previousEmployerName ?? "Not Specified").trim() || "Not Specified";
  return [{
    qualificationLevel: qual,
    degree: deg,
    institutionName: inst,
  }] as any;
}

/**
 * Master row normalization: takes raw mapped canonical row and applies all Layer 2 + 3 transforms.
 */
function normalizeRow(mapped: Record<string, any>): BulkImportRow {
  // Name handling: prefer firstName/lastName fields; fall back to fullName split
  let firstName = String(mapped.firstName ?? "").trim();
  let lastName = String(mapped.lastName ?? "").trim();
  if (!firstName && mapped.fullName) {
    const split = splitFullName(String(mapped.fullName));
    firstName = split.firstName;
    lastName = split.lastName;
  } else if (firstName && !lastName && firstName.includes(" ")) {
    const split = splitFullName(firstName);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  // Email: priority cascade
  const email = pickBestEmail(mapped) || "";

  // Phone
  const phone = cleanPhone(mapped.phone) || undefined;

  // Dates
  const joiningDateObj = parseAnyDate(mapped.joiningDate);
  const dobObj = parseAnyDate(mapped.dateOfBirth);
  const exitDateObj = parseAnyDate(mapped.exitDate);

  // Aadhaar: fix scientific notation, enforce 12 digits
  let aadhaar: string | undefined;
  if (mapped.aadhaar) {
    const cleaned = cleanScientificNumber(mapped.aadhaar, 12);
    if (cleaned && /^\d{12}$/.test(cleaned)) aadhaar = cleaned;
    else if (cleaned) aadhaar = cleaned; // store even if not exactly 12 — let validator warn
  }

  // PAN
  const pan = mapped.pan ? String(mapped.pan).trim().toUpperCase() : undefined;

  // Passport
  const passportNo = mapped.passportNo ? String(mapped.passportNo).trim().toUpperCase() : undefined;

  // Employee code from sheet: filter out dummy placeholders like "NA", "N/A", "-", "--", "NULL", "NONE"
  const rawCode = mapped.employeeCode ? String(mapped.employeeCode).trim().toUpperCase() : undefined;
  const isDummyCode = !rawCode || ["NA", "N/A", "-", "--", "N.A.", "NULL", "NONE", "NOT APPLICABLE"].includes(rawCode);
  const preservedEmployeeCode = isDummyCode ? undefined : rawCode;

  // Sub-documents (Layer 3)
  const bankAccount = extractBankAccount(mapped);
  const currentAddress = extractCurrentAddress(mapped);
  const permanentAddress = extractPermanentAddress(mapped);
  const emergencyContacts = extractEmergencyContacts(mapped);
  const educationDetails = extractEducationDetails(mapped);

  // Custom fields (unrecognized columns)
  const customFields: Record<string, any> = {};
  if (mapped.__customFields) {
    for (const [k, v] of Object.entries(mapped.__customFields)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        customFields[k] = v;
      }
    }
  }

  // Pack specific master sheet columns into customFields
  const extraFields: Record<string, any> = {
    workMode: mapped.workMode,
    skypeId: mapped.skypeId,
    personalEmail: mapped.email3,
    ctcPa: mapped.ctcPa,
    ctcPm: mapped.ctcPm,
    dobActual: mapped.dobActual,
    anniversaryDate: mapped.anniversaryDate,
    children: mapped.children,
    alternatePhone: cleanPhone(mapped.alternatePhone),
    secondaryAccountNumber: cleanScientificNumber(mapped.secondaryAccountNumber, 18),
    secondaryIfscCode: mapped.secondaryIfscCode,
    uanNo: cleanScientificNumber(mapped.uanNo, 12),
    esicNo: cleanScientificNumber(mapped.esicNo, 17),
    subDepartment: mapped.subDepartment,
    hiringSource: mapped.hiringSource,
    hiringReferrer: mapped.hiringReferrer,
    documentationDone: mapped.documentationDone,
    resignationDate: mapped.resignationDate,
    resignationType: mapped.resignationType,
    remarks: mapped.remarks,
  };

  for (const [k, v] of Object.entries(extraFields)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      customFields[k] = v;
    }
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    branchName: String(mapped.branchName ?? "").trim(),
    departmentName: String(mapped.departmentName ?? "").trim(),
    subDepartmentName: String(mapped.subDepartment ?? "").trim() || undefined,
    designationName: String(mapped.designationName ?? "").trim(),
    workMode: normalizeWorkMode(mapped.workMode),
    grade: String(mapped.grade ?? "").trim() || "NA",
    joiningDate: joiningDateObj ? joiningDateObj.toISOString() : String(mapped.joiningDate ?? "").trim(),
    employeeType: mapped.employeeType ? undefined : undefined, // will be normalized in parseImportFile
    gender: normalizeGender(mapped.gender),
    dateOfBirth: dobObj ? dobObj.toISOString() : undefined,
    pan,
    aadhaar,
    passportNo,
    countryCode: String(mapped.countryCode ?? "IN").trim().toUpperCase() || "IN",
    preservedEmployeeCode,
    bloodGroup: normalizeBloodGroup(mapped.bloodGroup),
    maritalStatus: normalizeMaritalStatus(mapped.maritalStatus),
    religion: normalizeReligion(mapped.religion),
    fatherName: String(mapped.fatherName ?? "").trim() || undefined,
    fatherPhone: cleanPhone(mapped.fatherPhone) || undefined,
    motherName: String(mapped.motherName ?? "").trim() || undefined,
    motherPhone: cleanPhone(mapped.motherPhone) || undefined,
    spouseName: String(mapped.spouseName ?? "").trim() || undefined,
    spousePhone: cleanPhone(mapped.spousePhone) || undefined,
    highestQualification: normalizeQualification(mapped.highestQualification),
    previousEmployerName: String(mapped.previousEmployerName ?? "").trim() || undefined,
    nationality: String(mapped.nationality ?? "").trim() || undefined,
    exitDate: exitDateObj ? exitDateObj.toISOString() : undefined,
    exitReason: String(mapped.exitReason ?? "").trim() || undefined,
    importedStatus: mapped.importedStatus ? String(mapped.importedStatus).trim() : undefined,
    reportingManagerName: String(mapped.reportingManagerName ?? "").trim() || undefined,
    bankAccount,
    currentAddress,
    permanentAddress,
    emergencyContacts: emergencyContacts?.length ? emergencyContacts : undefined,
    educationDetails: educationDetails?.length ? educationDetails : undefined,
    customFields: Object.keys(customFields).length ? customFields : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// CSV PARSER — Smart header detection
// ─────────────────────────────────────────────────────────────────

async function parseCSV(buffer: Buffer): Promise<{ rawRows: Record<string, any>[]; headerMap: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const rawRows: Record<string, any>[] = [];
    let headerMap: Record<string, string> = {};
    let headersDetected = false;

    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser())
      .on("headers", (headers: string[]) => {
        headerMap = mapHeaders(headers);
        headersDetected = true;
      })
      .on("data", (data: Record<string, any>) => {
        if (!headersDetected) {
          headerMap = mapHeaders(Object.keys(data));
          headersDetected = true;
        }
        rawRows.push(data);
      })
      .on("end", () => resolve({ rawRows, headerMap }))
      .on("error", (err: Error) => reject(err));
  });
}

// ─────────────────────────────────────────────────────────────────
// EXCEL PARSER — Smart header detection
// ─────────────────────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<{ rawRows: Record<string, any>[]; headerMap: Record<string, string> }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];

  const rawRows: Record<string, any>[] = [];
  let headers: string[] = [];
  let headerMap: Record<string, string> = {};

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as any[];

    if (rowNumber === 1) {
      // ExcelJS row.values is 1-indexed (index 0 is undefined)
      headers = values.slice(1).map(v => String(v ?? "").trim());
      headerMap = mapHeaders(headers);
      return;
    }

    const hasData = values.slice(1).some(v => v !== null && v !== undefined && v !== "");
    if (!hasData) return;

    const rawRow: Record<string, any> = {};
    headers.forEach((header, index) => {
      if (header) {
        rawRow[header] = values[index + 1]; // +1 because ExcelJS is 1-indexed
      }
    });
    rawRows.push(rawRow);
  });

  return { rawRows, headerMap };
}

// ─────────────────────────────────────────────────────────────────
// BATCH EMPLOYEE CODE ALLOCATOR (High Performance In-Memory Buffer)
// ─────────────────────────────────────────────────────────────────

class EmployeeCodeAllocator {
  private activeCodes: string[] = [];
  private exCodes: string[] = [];

  constructor(
    private tenantId: string,
    private exPrefix: string
  ) { }

  async getCode(isActive: boolean, remainingRows: number): Promise<string> {
    if (isActive) {
      if (this.activeCodes.length === 0) {
        const batchSize = Math.min(50, Math.max(1, remainingRows));
        this.activeCodes = await getNextBatchEmployeeCodes(this.tenantId, batchSize);
      }
      return this.activeCodes.shift()!;
    } else {
      if (this.exCodes.length === 0) {
        const batchSize = Math.min(50, Math.max(1, remainingRows));
        this.exCodes = await getNextBatchEmployeeCodes(this.tenantId, batchSize, this.exPrefix);
      }
      return this.exCodes.shift()!;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN PARSE FUNCTION
// ─────────────────────────────────────────────────────────────────

export async function parseImportFile(
  context: RequestContext,
  buffer: Buffer,
  fileType: "csv" | "xlsx"
): Promise<ParsedImportData> {

  const { rawRows, headerMap } = fileType === "csv"
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

  // ── Load master data
  const { getMasterDataMaps } = require("./master-data-cache");
  const cacheData = await getMasterDataMaps(context.tenantId);
  const branches = cacheData.branches;
  const departments = cacheData.departments;
  const designations = cacheData.designations;

  const branchMap = buildNameMap(branches);
  const departmentMap = buildNameMap(departments);

  const designationMap = new Map<string, { id: any; name: string; departmentId: any }>();
  for (const d of designations) {
    designationMap.set(normalize(d.name), { id: d._id, name: d.name, departmentId: d.departmentId });
  }

  const existingDeptCodes = new Set<string>(departments.map((d: any) => d.code as string));
  const existingDesigCodes = new Set<string>(designations.map((d: any) => d.code as string));

  const createdDepts: string[] = [];
  const createdDesigs: string[] = [];

  // Track existing emails and codes
  const existingEmployees = await EmployeeModel
    .find({ tenantId: tenantIdObj, isDeleted: false })
    .select("email employeeCode").lean();
  const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));
  const existingEmpCodes = new Set(existingEmployees.map(e => e.employeeCode?.toUpperCase()).filter(Boolean));

  // Also include any registered users in this tenant to prevent duplicate conflicts
  const existingUsers = await UserModel
    .find({ tenantId: tenantIdObj, isDeleted: false })
    .select("email").lean();
  for (const u of existingUsers) {
    if (u.email) existingEmails.add(u.email.toLowerCase());
  }

  // Custom fields map
  const activeCustomFields = await CustomFieldModel.find({
    tenantId: tenantIdObj, isDeleted: false, isActive: true,
  });
  const customFieldMap = new Map<string, string>();
  for (const cf of activeCustomFields) {
    customFieldMap.set(normalize(cf.fieldLabel), cf.fieldKey);
    customFieldMap.set(normalize(cf.fieldKey), cf.fieldKey);
  }

  // Find head office / first branch as fallback, or auto-create if tenant has no branches
  let headOfficeBranch = branches.find((b: any) => b.isHeadOffice) || branches[0] || null;
  if (!headOfficeBranch) {
    const orgDocForBranch = await OrganizationModel.findById(tenantIdObj).lean();
    const createdHeadOffice = await BranchModel.create({
      tenantId: tenantIdObj,
      name: "Head Office",
      code: "HQ",
      countryCode: orgDocForBranch?.locale?.countryCode || "IN",
      currency: orgDocForBranch?.locale?.currencyCode || "INR",
      isHeadquarters: true,
      isHeadOffice: true,
      isActive: true,
      isDeleted: false,
    });
    headOfficeBranch = createdHeadOffice.toObject();
    branches.push(headOfficeBranch);
    branchMap.set(normalize("Head Office"), { id: headOfficeBranch._id, name: "Head Office" });
    branchMap.set(normalize("HQ"), { id: headOfficeBranch._id, name: "Head Office" });
    await UserModel.findByIdAndUpdate(userIdObj, {
      $addToSet: { branchIds: headOfficeBranch._id },
    });
    const { invalidateMasterDataCache } = require("./master-data-cache");
    invalidateMasterDataCache(context.tenantId);
  }

  // Org prefix configuration for employee codes (dynamic: active = LOP, inactive = LOP-EX)
  const orgDoc = await OrganizationModel.findById(tenantIdObj).select("employeeCodeConfig").lean();
  const orgPrefix = (orgDoc?.employeeCodeConfig?.prefix || "EMP").trim().replace(/[-_]+$/, "").toUpperCase();
  const exPrefix = `${orgPrefix}-EX`;

  const codeAllocator = new EmployeeCodeAllocator(context.tenantId, exPrefix);

  const errors: ImportError[] = [];
  const warnings: ImportError[] = [];
  const validRecords: any[] = [];

  // ── Per-row processing
  for (let idx = 0; idx < rawRows.length; idx++) {
    const rawRow = rawRows[idx];
    const rowNumber = idx + 2;

    // Apply header mapping then normalize
    const mapped = applyHeaderMapping(rawRow, headerMap);
    const row = normalizeRow(mapped);

    // ── Resolve normalized status & employee type first
    const importedStatus = normalizeEmployeeStatus(row.importedStatus);
    const isActiveEmployee = [EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE].includes(importedStatus as any);
    const employeeType = normalizeEmployeeType(mapped.employeeType);

    const emailClean = row.email?.trim().toLowerCase() || "";

    // ─────────────────────────────────────────────────────────────
    // ZERO-FAILURE 3-TIER VALIDATION & AUTO-HEALING PIPELINE
    // ─────────────────────────────────────────────────────────────
    const needsAttentionFields: string[] = [];
    let rowStatus: 'CLEAN' | 'IMPORTED_INCOMPLETE' | 'POSSIBLE_DUPLICATE' | 'REJECTED' = 'CLEAN';

    // ── TIER 1: HARD REQUIRED IDENTITY (True Floor)
    // A row ONLY fails if BOTH firstName & lastName are missing, OR BOTH email & phone are missing.
    const rawFirstName = row.firstName?.trim() || "";
    const rawLastName = row.lastName?.trim() || "";
    const hasName = Boolean(rawFirstName || rawLastName);

    const rawEmail = row.email?.trim().toLowerCase() || "";
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = Boolean(rawEmail && EMAIL_REGEX.test(rawEmail));

    const rawPhone = (row.phone ? String(row.phone).replace(/\D/g, "") : "");
    const isValidPhone = rawPhone.length >= 7; // standard minimum length for phone number

    const hasContact = isValidEmail || isValidPhone;

    if (!hasName || !hasContact) {
      const missingParts: string[] = [];
      if (!hasName) missingParts.push("Employee Name (First or Last name required)");
      if (!hasContact) missingParts.push("Contact Info (Valid Email or Phone required)");
      const reason = `Tier 1 Required: ${missingParts.join(" and ")}`;
      errors.push({
        rowNumber,
        email: rawEmail || rawPhone,
        reason,
        severity: "ERROR",
      });
      continue;
    }

    // Resolve Name (Auto-heal single names)
    const finalFirstName = rawFirstName || rawLastName || "Employee";
    const finalLastName = rawFirstName ? rawLastName : "";
    if (!rawLastName) {
      needsAttentionFields.push("lastName");
    }

    // Resolve Email & Phone
    let finalEmail = rawEmail;
    if (!isValidEmail) {
      const fallbackDomain = orgDoc?.workspaceSlug ? `${orgDoc.workspaceSlug}.internal` : "company.internal";
      finalEmail = `emp_${rawPhone || rowNumber}@${fallbackDomain}`;
      needsAttentionFields.push("email");
      warnings.push({
        rowNumber,
        email: finalEmail,
        reason: `Email was missing or invalid — auto-generated placeholder "${finalEmail}" from phone`,
        severity: "WARNING",
      });
    }

    const finalPhone = isValidPhone ? rawPhone : (row.phone?.trim() || "0000000000");
    if (!isValidPhone) {
      needsAttentionFields.push("phone");
    }

    // Check duplicate email across organization (Orange flag)
    let isPossibleDuplicate = false;
    if (isValidEmail && existingEmails.has(finalEmail)) {
      isPossibleDuplicate = true;
      warnings.push({
        rowNumber,
        email: finalEmail,
        reason: `Email "${finalEmail}" matches an existing employee or user in the workspace`,
        severity: "WARNING",
      });
    }

    // ── TIER 2: AUTO-HEALABLE FIELDS (Defaults + Needs Attention Flag)

    // 1. Date of Joining (DOJ): default to today if missing/invalid
    let finalJoiningDate: Date;
    const parsedDOJ = parseAnyDate(row.joiningDate) || (row.joiningDate ? new Date(row.joiningDate) : null);
    if (!parsedDOJ || isNaN(parsedDOJ.getTime())) {
      finalJoiningDate = new Date();
      needsAttentionFields.push("joiningDate");
      warnings.push({
        rowNumber,
        email: finalEmail,
        reason: `Joining Date was missing or invalid — defaulted to today (${finalJoiningDate.toISOString().slice(0, 10)})`,
        severity: "WARNING",
      });
    } else {
      finalJoiningDate = parsedDOJ;
    }

    // 2. Department: default to "Unassigned" if missing
    let targetDeptName = row.departmentName?.trim();
    if (!targetDeptName) {
      targetDeptName = "Unassigned";
      needsAttentionFields.push("department");
      warnings.push({
        rowNumber,
        email: finalEmail,
        reason: 'Department was missing — auto-assigned to "Unassigned"',
        severity: "WARNING",
      });
    }

    // 3. Designation: default to "Not Set" if missing
    let targetDesigName = row.designationName?.trim();
    if (!targetDesigName) {
      targetDesigName = "Not Set";
      needsAttentionFields.push("designation");
      warnings.push({
        rowNumber,
        email: finalEmail,
        reason: 'Designation was missing — auto-assigned to "Not Set"',
        severity: "WARNING",
      });
    }

    // 4. Employment Type: default to FULL_TIME if missing
    let targetEmployeeType = employeeType || EmployeeType.FULL_TIME;
    if (!mapped.employeeType) {
      needsAttentionFields.push("employeeType");
    }

    // ── TIER 3: OPTIONAL FIELDS (No defaults, strip if invalid)
    let finalGender = row.gender;
    if (!finalGender || !Object.values(Gender).includes(finalGender as any)) {
      finalGender = Gender.OTHER;
    }

    let finalDOB: Date | undefined;
    if (row.dateOfBirth) {
      const parsedDOB = new Date(row.dateOfBirth);
      if (!isNaN(parsedDOB.getTime())) {
        finalDOB = parsedDOB;
      } else {
        warnings.push({
          rowNumber,
          email: finalEmail,
          reason: `Date of Birth "${row.dateOfBirth}" was invalid — field cleared`,
          severity: "WARNING",
        });
      }
    }

    // ── Branch resolution with smart auto-creation and fallback
    let branchId: mongoose.Types.ObjectId;
    const branchInput = row.branchName?.trim();
    if (branchInput) {
      const branchEntry = fuzzyMatch(branchInput, branchMap);
      if (branchEntry) {
        branchId = new mongoose.Types.ObjectId(branchEntry.id);
        if (!branchEntry.exact) {
          warnings.push({ rowNumber, email: emailClean, reason: `Branch "${branchInput}" matched to existing branch "${branchEntry.matchedName}"`, severity: "WARNING" });
        }
      } else if (headOfficeBranch) {
        // If the tenant only has the generic default "Head Office" (code "HQ"), specialize it to this branch name
        if (branches.length === 1 && headOfficeBranch.name === "Head Office" && headOfficeBranch.code === "HQ") {
          const newCode = branchInput.toUpperCase().slice(0, 10).replace(/[^A-Z0-9]/g, "") || "HQ";
          await BranchModel.findByIdAndUpdate(headOfficeBranch._id, {
            $set: { name: branchInput, code: newCode }
          });
          headOfficeBranch.name = branchInput;
          headOfficeBranch.code = newCode;
          branchMap.set(normalize(branchInput), { id: headOfficeBranch._id.toString(), name: branchInput });
          branchId = new mongoose.Types.ObjectId(headOfficeBranch._id);
          warnings.push({ rowNumber, email: emailClean, reason: `Head Office automatically named "${branchInput}" from import data`, severity: "WARNING" });
        } else {
          // Dynamic auto-creation: create new branch so employees are organized accurately
          const newCode = branchInput.toUpperCase().slice(0, 10).replace(/[^A-Z0-9]/g, "") || `BR-${branches.length + 1}`;
          try {
            const newBranch = await BranchModel.create({
              tenantId: tenantIdObj,
              name: branchInput,
              code: newCode,
              countryCode: (headOfficeBranch as any).countryCode || "IN",
              currency: (headOfficeBranch as any).currency || "INR",
              isHeadOffice: false,
              isActive: true,
              isDeleted: false,
            });
            const newBranchObj = newBranch.toObject();
            branches.push(newBranchObj);
            branchMap.set(normalize(branchInput), { id: newBranchObj._id.toString(), name: branchInput });
            branchId = new mongoose.Types.ObjectId(newBranchObj._id);
            warnings.push({ rowNumber, email: emailClean, reason: `Branch "${branchInput}" did not exist — automatically created`, severity: "WARNING" });
          } catch {
            branchId = new mongoose.Types.ObjectId(headOfficeBranch._id);
            warnings.push({ rowNumber, email: emailClean, reason: `Branch "${branchInput}" not found — auto-assigned to "${headOfficeBranch.name}" (head office)`, severity: "WARNING" });
          }
        }
      } else {
        branchId = new mongoose.Types.ObjectId((headOfficeBranch as any)._id);
      }
    } else {
      // No branch column in sheet at all — use head office
      branchId = new mongoose.Types.ObjectId((headOfficeBranch as any)._id);
      warnings.push({ rowNumber, email: emailClean, reason: `No branch specified — auto-assigned to "${(headOfficeBranch as any).name}" (head office)`, severity: "WARNING" });
    }

    // ── Department & Sub-Department — Exact Match & Parent-Child Auto-Creation
    const parentDeptResult = await findOrCreateDepartment(
      tenantIdObj, branchId, userIdObj,
      targetDeptName, departmentMap, existingDeptCodes, createdDepts
    );
    if (parentDeptResult.wasCreated) {
      warnings.push({ rowNumber, email: emailClean, reason: `Department "${targetDeptName}" did not exist — auto-created as "${parentDeptResult.name}"`, severity: "WARNING" });
    }

    let effectiveDeptId = new mongoose.Types.ObjectId(parentDeptResult.id);
    let effectiveDeptName = parentDeptResult.name;

    // Sub-department: if present and distinct, link to parent department via parentId
    if (row.subDepartmentName && normalize(row.subDepartmentName) !== normalize(targetDeptName)) {
      const subDeptResult = await findOrCreateDepartment(
        tenantIdObj, branchId, userIdObj,
        row.subDepartmentName, departmentMap, existingDeptCodes, createdDepts,
        effectiveDeptId
      );
      if (subDeptResult.wasCreated) {
        warnings.push({ rowNumber, email: emailClean, reason: `Sub-department "${row.subDepartmentName}" auto-created under "${parentDeptResult.name}"`, severity: "WARNING" });
      }
      effectiveDeptId = new mongoose.Types.ObjectId(subDeptResult.id);
      effectiveDeptName = subDeptResult.name;
    }

    // ── Designation — Exact Match within Department or Auto-Create (NO cross-dept fuzzy guessing!)
    const desigResult = await findOrCreateDesignation(
      tenantIdObj, branchId, userIdObj,
      effectiveDeptId,
      targetDesigName, designationMap, existingDesigCodes, createdDesigs
    );
    if (desigResult.wasCreated) {
      warnings.push({ rowNumber, email: emailClean, reason: `Designation "${targetDesigName}" did not exist — auto-created as "${desigResult.name}" under "${effectiveDeptName}"`, severity: "WARNING" });
    }

    // ── Statutory validations via country plugin
    const countryCode = (row.countryCode?.trim() || "IN").toUpperCase();
    const countryModule = getCountryModule(countryCode);
    let statutoryValid = true;
    for (const field of countryModule.statutoryFields) {
      const val = (row as any)[field.key]?.trim?.();
      if (val) {
        const checkResult = field.validate(val);
        if (typeof checkResult === "string") {
          warnings.push({ rowNumber, email: emailClean, reason: `Invalid ${field.label}: ${checkResult} — field will be cleared`, severity: "WARNING" });
          (row as any)[field.key] = undefined;
        }
      } else if (field.required) {
        warnings.push({ rowNumber, email: emailClean, reason: `${field.label} is recommended for country ${countryCode} but was not found`, severity: "WARNING" });
      }
    }
    if (!statutoryValid) continue;

    // ── Custom fields — resolve against registered custom field keys
    const resolvedCustomFields: Record<string, any> = {};
    if (row.customFields) {
      for (const [rawKey, rawVal] of Object.entries(row.customFields)) {
        const normalizedKey = normalize(rawKey);
        let finalKey: string;
        if (customFieldMap.has(normalizedKey)) {
          finalKey = customFieldMap.get(normalizedKey)!;
        } else {
          let matchedKey: string | null = null;
          for (const [normLabel, actualKey] of customFieldMap.entries()) {
            if (levenshtein(normalizedKey, normLabel) <= 2) { matchedKey = actualKey; break; }
          }
          finalKey = matchedKey || rawKey;
        }
        // Sanitize key for Mongo storage: dots and dollar signs are prohibited in keys
        const safeKey = finalKey.replace(/\./g, "_").replace(/^\$/, "_").trim();
        if (safeKey) {
          resolvedCustomFields[safeKey] = rawVal;
        }
      }
    }

    // ── Employee code: preserve exact code from sheet if present, else generate sequentially
    let employeeCode: string;
    const sheetCode = row.preservedEmployeeCode ? String(row.preservedEmployeeCode).trim().toUpperCase() : "";
    const remainingRows = rawRows.length - idx;

    if (sheetCode) {
      if (existingEmpCodes.has(sheetCode)) {
        warnings.push({ rowNumber, email: emailClean, reason: `Employee code "${sheetCode}" already exists — a new code will be auto-generated`, severity: "WARNING" });
        employeeCode = await codeAllocator.getCode(isActiveEmployee, remainingRows);
        existingEmpCodes.add(employeeCode);
      } else {
        employeeCode = sheetCode;
        existingEmpCodes.add(employeeCode); // preserve exact sheet code (e.g. RVG001, RVG017)
      }
    } else {
      // No employee code in sheet — auto-generate sequentially according to Org configuration
      employeeCode = await codeAllocator.getCode(isActiveEmployee, remainingRows);
      existingEmpCodes.add(employeeCode);
    }

    if (!finalEmail) {
      finalEmail = `${employeeCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@archive.local`;
    }

    // ── Build employee document
    const newEmpId = new mongoose.Types.ObjectId();

    // Pre-calculate onboarding step completion so bulk imported employees don't have to re-fill wizard
    const hasPersonal = !!(row.firstName && (row.phone || row.dateOfBirth || row.currentAddress?.addressLine1));
    const hasFamily = !!(row.fatherName || row.motherName || row.spouseName);
    const hasBank = !!(row.bankAccount?.accountNumber && row.bankAccount?.ifscCode);
    const hasDocs = !!(row.pan || row.aadhaar);

    // Ensure workMode, grade, and subDepartment are in customFields for backward compatibility
    resolvedCustomFields.workMode = row.workMode || "OFFICE";
    resolvedCustomFields.grade = row.grade || "NA";
    if (row.subDepartmentName) resolvedCustomFields.subDepartment = row.subDepartmentName;

    // Determine 4-tier row status:
    if (isPossibleDuplicate) {
      rowStatus = 'POSSIBLE_DUPLICATE';
    } else if (needsAttentionFields.length > 0) {
      rowStatus = 'IMPORTED_INCOMPLETE';
    } else {
      rowStatus = 'CLEAN';
    }

    const importStatus = needsAttentionFields.length > 0 ? 'IMPORTED_INCOMPLETE' : 'CLEAN';

    const employeeDoc: any = {
      _id: newEmpId,
      tenantId: tenantIdObj,
      branchId,
      departmentId: effectiveDeptId,
      designationId: new mongoose.Types.ObjectId(desigResult.id),
      subDepartment: row.subDepartmentName || undefined,
      workMode: row.workMode || "OFFICE",
      grade: row.grade || "NA",
      employeeCode,
      firstName: finalFirstName,
      lastName: finalLastName,
      email: finalEmail,
      phone: finalPhone,
      joiningDate: finalJoiningDate,
      employeeType: targetEmployeeType,
      status: importedStatus,
      gender: finalGender,
      dateOfBirth: finalDOB,
      importStatus,
      needsAttentionFields,
      __rowStatus: rowStatus,
      __isPossibleDuplicate: isPossibleDuplicate,
      __rowNumber: rowNumber,
      pan: row.pan,
      aadhaar: row.aadhaar,
      passportNo: row.passportNo,
      countryCode,
      bloodGroup: row.bloodGroup,
      maritalStatus: row.maritalStatus,
      religion: row.religion,
      nationality: row.nationality,
      fatherName: row.fatherName,
      fatherPhone: row.fatherPhone,
      motherName: row.motherName,
      motherPhone: row.motherPhone,
      spouseName: row.spouseName,
      spousePhone: row.spousePhone,
      highestQualification: row.highestQualification,
      previousEmployerName: row.previousEmployerName,
      customFields: resolvedCustomFields,
      isActive: isActiveEmployee,
      // Exit info for resigned/terminated
      exitDate: !isActiveEmployee && row.exitDate ? new Date(row.exitDate) : undefined,
      exitReason: !isActiveEmployee ? row.exitReason : undefined,
      // Address
      currentAddress: row.currentAddress,
      permanentAddress: row.permanentAddress,
      // Emergency contacts
      emergencyContacts: row.emergencyContacts || [],
      // Education
      educationDetails: row.educationDetails || [],
      // Smart wizard progress mapping: auto-mark completed steps so employees don't re-fill
      onboardingStep: (hasPersonal && hasFamily && hasBank && hasDocs) ? 5 : (hasPersonal && hasFamily && hasBank) ? 4 : (hasPersonal && hasFamily) ? 3 : hasPersonal ? 2 : 1,
      onboardingComplete: hasPersonal && hasFamily && hasBank && hasDocs,
      isProfileComplete: hasPersonal && hasFamily && hasBank && hasDocs,
      onboardingStepsCompleted: {
        personalDetails: hasPersonal,
        familyDetails: hasFamily,
        bankDetails: hasBank,
        documents: hasDocs,
        reviewed: hasPersonal && hasFamily && hasBank && hasDocs,
      },
      createdBy: userIdObj,
      updatedBy: userIdObj,
      // Carry bank account, family members, and reporting manager for post-insert processing
      __bankAccount: row.bankAccount,
      __isActiveEmployee: isActiveEmployee,
      __reportingManagerName: row.reportingManagerName,
      __familyMembers: [
        row.fatherName ? { fullName: row.fatherName, relationship: "FATHER", phone: row.fatherPhone } : null,
        row.motherName ? { fullName: row.motherName, relationship: "MOTHER", phone: row.motherPhone } : null,
        row.spouseName ? { fullName: row.spouseName, relationship: "SPOUSE", phone: row.spousePhone } : null,
      ].filter(Boolean),
    };

    validRecords.push(employeeDoc);
    if (finalEmail) existingEmails.add(finalEmail);
    existingEmpCodes.add(employeeCode);
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

// ─────────────────────────────────────────────────────────────────
// EXPORT BUILDER (preserved from original)
// ─────────────────────────────────────────────────────────────────

export async function buildExportBuffer(
  employees: any[],
  format: "csv" | "xlsx"
): Promise<Buffer> {
  const columns = [
    { header: "S.No.", key: "sNo", width: 8 },
    { header: "Emp Code", key: "employeeCode", width: 18 },
    { header: "Employee Name", key: "fullName", width: 25 },
    { header: "First Name", key: "firstName", width: 18 },
    { header: "Last Name", key: "lastName", width: 18 },
    { header: "Org Name", key: "orgName", width: 22 },
    { header: "Employee Status", key: "status", width: 15 },
    { header: "Employee Type", key: "employeeType", width: 15 },
    { header: "Designation", key: "designation", width: 28 },
    { header: "Department", key: "department", width: 25 },
    { header: "Sub Department", key: "subDepartment", width: 22 },
    { header: "Branch", key: "branch", width: 20 },
    { header: "DOJ", key: "joiningDate", width: 15 },
    { header: "Reporting Manager", key: "reportingManager", width: 25 },
    { header: "WFH/Office", key: "workMode", width: 14 },
    { header: "Official Mail ID", key: "email", width: 32 },
    { header: "New Mail id", key: "newMailId", width: 32 },
    { header: "Personal Mail ID", key: "personalEmail", width: 30 },
    { header: "Skype ID", key: "skypeId", width: 25 },
    { header: "Contact Number", key: "phone", width: 16 },
    { header: "Alternate Contact No.", key: "alternatePhone", width: 18 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "DOB (OFFICIAL)", key: "dateOfBirth", width: 15 },
    { header: "DOB(Actual)", key: "dobActual", width: 15 },
    { header: "Religion", key: "religion", width: 14 },
    { header: "Marital Status", key: "maritalStatus", width: 15 },
    { header: "Date of Anniversary", key: "anniversaryDate", width: 18 },
    { header: "Children", key: "children", width: 10 },
    { header: "Blood Group", key: "bloodGroup", width: 12 },
    { header: "Current Address", key: "currentAddress", width: 35 },
    { header: "Permanent Address", key: "permanentAddress", width: 35 },
    { header: "Passport Number", key: "passportNo", width: 16 },
    { header: "Pan Card No.", key: "pan", width: 16 },
    { header: "Aadhar Card No.", key: "aadhaar", width: 18 },
    { header: "Bank Name", key: "bankName", width: 22 },
    { header: "Account Number", key: "accountNumber", width: 20 },
    { header: "IFSC Code", key: "ifscCode", width: 15 },
    { header: "ICICI Account Number", key: "secondaryAccountNumber", width: 22 },
    { header: "Secondary IFSC Code", key: "secondaryIfscCode", width: 18 },
    { header: "UAN No.", key: "uanNo", width: 18 },
    { header: "ESIC No.", key: "esicNo", width: 18 },
    { header: "CTC (PA)", key: "ctcPa", width: 15 },
    { header: "CTC (PM)", key: "ctcPm", width: 15 },
    { header: "Highest Education", key: "highestQualification", width: 20 },
    { header: "Previous Employer Name", key: "previousEmployerName", width: 28 },
    { header: "Last Working Day (Previous)", key: "previousEmployerLastWorkingDate", width: 22 },
    { header: "Father's Name", key: "fatherName", width: 22 },
    { header: "Father's Contact Number", key: "fatherPhone", width: 20 },
    { header: "Mother Name", key: "motherName", width: 22 },
    { header: "Mother's Contact Number", key: "motherPhone", width: 20 },
    { header: "Spouse Name", key: "spouseName", width: 22 },
    { header: "Spouse Contact Number", key: "spousePhone", width: 20 },
    { header: "Source/Reference of Hiring", key: "hiringSource", width: 22 },
    { header: "Source/Reference Name", key: "hiringReferrer", width: 22 },
    { header: "Documentation Done (Yes/No)", key: "documentationDone", width: 22 },
    { header: "Date of Resignation", key: "resignationDate", width: 18 },
    { header: "Resignation Type(Vol/InVol)", key: "resignationType", width: 22 },
    { header: "LWD(Last Working Day)", key: "exitDate", width: 18 },
    { header: "Reason of Resignation", key: "exitReason", width: 25 },
    { header: "Remarks", key: "remarks", width: 30 },
  ];

  const formatExportDate = (val: any): string => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const day = String(d.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
  };

  const rows = employees.map((emp, idx) => {
    const cf = emp.customFields || {};
    const primaryBank = emp.primaryBankAccount || {};

    const currAddr = emp.currentAddress
      ? [emp.currentAddress.addressLine1, emp.currentAddress.addressLine2, emp.currentAddress.city, emp.currentAddress.state, emp.currentAddress.zip].filter(Boolean).join(", ")
      : "";
    const permAddr = emp.permanentAddress
      ? [emp.permanentAddress.addressLine1, emp.permanentAddress.addressLine2, emp.permanentAddress.city, emp.permanentAddress.state, emp.permanentAddress.zip].filter(Boolean).join(", ")
      : "";

    const mgr = emp.managerId
      ? [emp.managerId.firstName, emp.managerId.lastName].filter(Boolean).join(" ")
      : "";

    return {
      sNo: idx + 1,
      employeeCode: emp.employeeCode || "",
      fullName: [emp.firstName, emp.lastName].filter(Boolean).join(" "),
      firstName: emp.firstName || "",
      lastName: emp.lastName || "",
      orgName: emp.tenantId?.name || "Redvision",
      status: emp.status || "",
      employeeType: emp.employeeType || "",
      designation: emp.designationId?.name || "",
      department: emp.departmentId?.name || "",
      subDepartment: cf.subDepartment || emp.teamId?.name || "",
      branch: emp.branchId?.name || "",
      joiningDate: formatExportDate(emp.joiningDate),
      reportingManager: mgr,
      workMode: cf.workMode || cf.wfhOrOffice || "WFO",
      email: emp.email || "",
      newMailId: cf.newMailId || emp.email || "",
      personalEmail: cf.personalEmail || "",
      skypeId: cf.skypeId || "",
      phone: emp.phone || "",
      alternatePhone: cf.alternatePhone || "",
      gender: emp.gender || "",
      dateOfBirth: formatExportDate(emp.dateOfBirth),
      dobActual: cf.dobActual ? formatExportDate(cf.dobActual) : "",
      religion: emp.religion || "",
      maritalStatus: emp.maritalStatus || "",
      anniversaryDate: cf.anniversaryDate ? formatExportDate(cf.anniversaryDate) : (cf.dateOfAnniversary ? formatExportDate(cf.dateOfAnniversary) : ""),
      children: cf.children ?? "",
      bloodGroup: emp.bloodGroup || "",
      currentAddress: currAddr,
      permanentAddress: permAddr,
      passportNo: emp.passportNo || "",
      pan: emp.pan || "",
      aadhaar: emp.aadhaar || "",
      bankName: primaryBank.bankName || "",
      accountNumber: primaryBank.accountNumber || "",
      ifscCode: primaryBank.ifscCode || "",
      secondaryAccountNumber: cf.secondaryAccountNumber || cf.iciciAccountNumber || "",
      secondaryIfscCode: cf.secondaryIfscCode || "",
      uanNo: cf.uanNo || "",
      esicNo: cf.esicNo || "",
      ctcPa: cf.ctcPa ?? "",
      ctcPm: cf.ctcPm ?? "",
      highestQualification: emp.highestQualification || (emp.educationDetails?.[0]?.degree || emp.educationDetails?.[0]?.qualificationLevel || ""),
      previousEmployerName: emp.previousEmployerName || "",
      previousEmployerLastWorkingDate: formatExportDate(emp.previousEmployerLastWorkingDate),
      fatherName: emp.fatherName || "",
      fatherPhone: emp.fatherPhone || "",
      motherName: emp.motherName || "",
      motherPhone: emp.motherPhone || "",
      spouseName: emp.spouseName || "",
      spousePhone: emp.spousePhone || "",
      hiringSource: cf.hiringSource || "",
      hiringReferrer: cf.hiringReferrer || cf.hiringReferenceName || "",
      documentationDone: emp.onboardingComplete ? "Yes" : (cf.documentationDone || "No"),
      resignationDate: cf.resignationDate ? formatExportDate(cf.resignationDate) : "",
      resignationType: cf.resignationType || "",
      exitDate: formatExportDate(emp.exitDate),
      exitReason: emp.exitReason || "",
      remarks: cf.remarks || "",
    };
  });

  if (format === "csv") {
    const headerLine = columns.map(c => `"${c.header}"`).join(",");
    const dataLines = rows.map(row =>
      columns.map(c => `"${String((row as any)[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    return Buffer.from([headerLine, ...dataLines].join("\n"), "utf-8");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Employees");
  worksheet.columns = columns;
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2886CE" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;
  for (const row of rows) { worksheet.addRow(row); }
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─────────────────────────────────────────────────────────────────
// IMPORT TEMPLATE GENERATOR (preserved from original)
// ─────────────────────────────────────────────────────────────────

export async function buildImportTemplate(
  format: "csv" | "xlsx",
  tenantId?: string,
  branchId?: string,
  departmentId?: string
): Promise<Buffer> {
  const sampleRows: Record<string, any>[] = [
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

  const columns: { header: string; key: string; width: number }[] = [
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

  let dynamicCustomFields: any[] = [];
  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
    const orConditions: Record<string, any>[] = [{ scope: "ORGANIZATION" }];
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      orConditions.push({ scope: "BRANCH", branchId: new mongoose.Types.ObjectId(branchId) });
    }
    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      orConditions.push({ scope: "DEPARTMENT", departmentId: new mongoose.Types.ObjectId(departmentId) });
    }
    dynamicCustomFields = await CustomFieldModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false, isActive: true, showInBulkImport: true, $or: orConditions,
    }).sort({ order: 1, createdAt: 1 });

    for (const cf of dynamicCustomFields) {
      columns.push({ header: cf.fieldLabel, key: cf.fieldKey, width: Math.max(cf.fieldLabel.length + 6, 20) });
      sampleRows[0][cf.fieldKey] = cf.defaultValue ?? (cf.options?.length > 0 ? cf.options[0] : "");
    }
  }

  if (format === "csv") {
    const header = columns.map(c => `"${c.header}"`).join(",");
    const sample = columns.map(c => `"${(sampleRows[0] as any)[c.key] ?? ""}"`).join(",");
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

  const notes = workbook.addWorksheet("Valid Values");
  notes.addRow(["Field", "Valid Values / Instructions"]);
  notes.addRow(["Employee Type", "FULL_TIME, PART_TIME, CONTRACT, INTERN, CONSULTANT"]);
  notes.addRow(["Gender", "MALE, FEMALE, OTHER"]);
  notes.addRow(["Joining Date", "YYYY-MM-DD or any date format e.g. 13-Jan-2024"]);
  notes.addRow(["Date of Birth", "YYYY-MM-DD or any date format e.g. 20-Jun-1995"]);
  notes.addRow(["Department", "Exact name or close match — auto-created if not found"]);
  notes.addRow(["Designation", "Exact name or close match — auto-created if not found"]);
  notes.addRow(["Branch", "Fuzzy matched — falls back to Head Office if not found"]);
  notes.addRow(["PAN", "10-character PAN e.g. ABCDE1234F"]);
  notes.addRow(["Aadhaar", "12-digit Aadhaar number (scientific notation handled automatically)"]);

  for (const cf of dynamicCustomFields) {
    let desc = `Type: ${cf.fieldType}`;
    if (cf.options?.length > 0) desc += ` | Options: ${cf.options.join(", ")}`;
    if (cf.isRequired) desc += ` | Mandatory`;
    notes.addRow([cf.fieldLabel, desc]);
  }

  notes.getRow(1).font = { bold: true };
  notes.columns = [{ width: 25 }, { width: 65 }];
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
