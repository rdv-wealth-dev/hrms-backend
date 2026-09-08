# 🚀 HRMS Smart Bulk Import — Frontend Integration Guide

> **Document Version:** 2.0  
> **Last Updated:** September 8, 2026  
> **Target Audience:** Frontend Developers (React / Next.js / Vue / Angular)  
> **Base URL:** `/api/v1/employees`  
> **Auth Header Required:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`

---

## 📌 1. What's New in Today's Update (Engine Capabilities)

The backend import engine has been completely overhauled from a rigid, strict CSV/Excel parser into a **Universal Intelligent Ingestion Engine**:

1. **Smart Header Detection (100+ Synonyms):**  
   Columns can have almost any header name (e.g. `Official Mail ID`, `DOJ`, `Emp Code`, `Aadhar Card No.`, `Account Number`). The system maps them automatically to canonical HRMS fields.
2. **Universal Data Normalization:**  
   - Full names (`"Arpit Jain"`) are automatically split into `firstName` and `lastName`.
   - Any date format (`"Monday, August 13, 2012"`, `"11-Feb-89"`, `"13/08/2012"`, Excel serial numbers) is parsed accurately.
   - Excel scientific notation (e.g. `6.66E+11` Aadhaar / Bank A/C) is automatically converted to clean numbers.
3. **Sub-Document Auto-Creation:**  
   Bank accounts, emergency contacts, addresses, and education columns in the sheet are automatically extracted and saved to their respective sub-collections.
4. **Inactive Employee Archive Policy:**  
   - Inactive/resigned employees in the sheet without an employee code are automatically assigned an isolated archive prefix: **`RVG-EX-001`**, **`RVG-EX-002`**...
   - **Main Active `RVG` sequence is never burned or affected.**
   - Inactive employees **do not get user login accounts**, **do not get passwords**, and **do not consume workspace subscription headcount**.
5. **Atomic Counter Sync & Self-Healing:**  
   Importing preserved employee codes (e.g. `RVG001` to `RVG150`) automatically syncs the database counter to the highest number (`150`). The next manually created employee is guaranteed to receive `RVG151`.
6. **Zero-Email Policy by Default:**  
   Import does **not** blast welcome emails. Employees receive a hashed temporary password (`Welcome@2026`), and `requiresPasswordReset: true` is set so they set their own password upon first login.

---

## 🛣️ 2. API Endpoints Overview

| Method | Endpoint | Description | Content-Type |
|---|---|---|---|
| `POST` | `/api/v1/employees/bulk-import` | **Direct 1-Click Import** (Fast upload & commit) | `multipart/form-data` |
| `POST` | `/api/v1/employees/import/validate` | **Wizard Step 1:** Upload file & start validation session | `multipart/form-data` |
| `GET` | `/api/v1/employees/import/:sessionId/preview` | **Wizard Step 2:** Fetch paginated preview & row-by-row status | `application/json` |
| `POST` | `/api/v1/employees/import/:sessionId/commit` | **Wizard Step 3:** Final commit of valid records | `application/json` |
| `GET` | `/api/v1/employees/import-template` | Download sample Excel / CSV template | `application/json` |
| `GET` | `/api/v1/employees/bulk-export` | Export filtered employee records to Excel/CSV | `application/json` |
| `GET` | `/api/v1/employees/audit/import-export-history` | Audit trail of past imports & exports | `application/json` |

---

## ⚡ 3. Direct Import (1-Click Flow)

Use this endpoint for simple import dialogs where the user selects a file and clicks **"Upload & Import"**.

### `POST /api/v1/employees/bulk-import`

#### Headers
```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Payload (`FormData`)
| Key | Type | Required | Description | Default |
|---|---|---|---|---|
| `file` | `File` (Binary) | **Yes** | `.xlsx` or `.csv` spreadsheet file (max 10MB) | — |
| `sendWelcomeEmail` | `boolean` (string or bool) | No | Whether to send welcome emails to newly active users | `false` |
| `defaultPassword` | `string` | No | Override default temporary login password | `Welcome@<year>` (e.g. `Welcome@2026`) |

#### Axios Example
```typescript
import axios from "axios";

async function directBulkImport(file: File, sendWelcomeEmail = false) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sendWelcomeEmail", String(sendWelcomeEmail));
  // Optional: formData.append("defaultPassword", "CustomPass@2026");

  const response = await axios.post("/api/v1/employees/bulk-import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  return response.data;
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Bulk import processed successfully",
  "data": {
    "totalProcessed": 150,
    "insertedCount": 148,
    "failedCount": 2,
    "defaultPassword": "Welcome@2026",
    "created": {
      "departments": ["Sales", "Engineering"],
      "designations": ["Software Consultant"]
    },
    "warnings": [
      {
        "rowNumber": 4,
        "email": "arpit@redvisiontech.com",
        "reason": "Branch \"Indore Branch\" not found — auto-assigned to \"Head Office\". You can update later.",
        "severity": "WARNING"
      },
      {
        "rowNumber": 12,
        "email": "rvg-ex-001@archive.local",
        "reason": "No email found for inactive employee — imported as historical archive record without user login",
        "severity": "WARNING"
      }
    ],
    "errors": [
      {
        "rowNumber": 50,
        "reason": "Employee name (First Name) is missing — could not find name column in this row",
        "severity": "ERROR"
      }
    ]
  }
}
```

> [!NOTE]
> `defaultPassword` will only be returned when `sendWelcomeEmail` is `false`. Frontend should show a dismissible copyable alert banner:  
> *"148 employees imported successfully. Temporary password for active employees is **Welcome@2026**. Users will be prompted to reset password on first login."*

---

## 🧙‍♂️ 4. Preview-Before-Commit Workflow (Recommended UI)

For an enterprise-grade experience with a 3-step wizard:
```
Step 1: Upload & Validate ➔ Step 2: Review Table (Valid / Warnings / Errors) ➔ Step 3: Confirm & Commit
```

---

### Step 1: Upload & Validate File
#### `POST /api/v1/employees/import/validate`

#### Request Payload (`FormData`)
```http
POST /api/v1/employees/import/validate
Content-Type: multipart/form-data
Authorization: Bearer <token>

[Form Data: file = employees.xlsx]
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Import file validated. Review preview details.",
  "data": {
    "sessionId": "b8f042e6-7b83-4a81-9b16-836e4f3a1290",
    "fileName": "employees.xlsx",
    "status": "validating"
  }
}
```

---

### Step 2: Fetch Preview Details
#### `GET /api/v1/employees/import/:sessionId/preview?pageNumber=1&pageSize=20`

#### Query Parameters
- `pageNumber` (number, default: `1`)
- `pageSize` (number, default: `20`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Import preview page fetched",
  "data": {
    "sessionId": "b8f042e6-7b83-4a81-9b16-836e4f3a1290",
    "fileName": "employees.xlsx",
    "status": "validated",
    "totalRows": 150,
    "pageNumber": 1,
    "pageSize": 20,
    "rows": [
      {
        "rowNumber": 2,
        "status": "valid",
        "action": "create",
        "data": {
          "employeeCode": "RVG001",
          "firstName": "Faiz",
          "lastName": "Ahmad Khan",
          "email": "faiz@redvisiontech.com",
          "departmentName": "Sales",
          "designationName": "Software Consultant",
          "status": "ACTIVE"
        },
        "errors": [],
        "warnings": []
      },
      {
        "rowNumber": 3,
        "status": "warning",
        "action": "create",
        "data": {
          "employeeCode": "RVG-EX-001",
          "firstName": "Arpit",
          "lastName": "Jain",
          "email": "arpit@redvisiontech.com",
          "status": "RESIGNED",
          "exitDate": "2024-05-31T00:00:00.000Z",
          "exitReason": "For better Opportunity"
        },
        "errors": [],
        "warnings": [
          "No employee code found for inactive employee — assigned archive code RVG-EX-001"
        ]
      },
      {
        "rowNumber": 15,
        "status": "error",
        "action": "skip",
        "data": {
          "firstName": "",
          "email": "invalid.email"
        },
        "errors": [
          "Employee name (First Name) is missing"
        ],
        "warnings": []
      }
    ]
  }
}
```

#### Frontend Row Status UI Indicators:
- `status: "valid"` ➔ 🟢 Green Checkmark (`Ready to import`)
- `status: "warning"` ➔ 🟡 Yellow Warning Badge (`Will import with fallback, hover for details`)
- `status: "error"` ➔ 🔴 Red Danger Badge (`Will be skipped, hover for error reason`)

---

### Step 3: Commit Import
#### `POST /api/v1/employees/import/:sessionId/commit`

#### Request Payload (`application/json`)
```json
{
  "sendWelcomeEmail": false,
  "defaultPassword": "Welcome@2026"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Employees imported successfully",
  "data": {
    "sessionId": "b8f042e6-7b83-4a81-9b16-836e4f3a1290",
    "status": "committed",
    "totalRows": 150,
    "insertedCount": 148,
    "defaultPassword": "Welcome@2026"
  }
}
```

---

## 📥 5. Download Sample Template

Give users a pre-formatted Excel or CSV template.

#### `GET /api/v1/employees/import-template?format=xlsx`
#### Query Parameters:
- `format`: `"xlsx"` (default) or `"csv"`

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Import template generated",
  "data": {
    "fileName": "employee_import_template.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "fileData": "UEsDBBQAAAAIA..."
  }
}
```

#### Frontend File Download Helper
```typescript
function downloadBase64File(base64Data: string, fileName: string, mimeType: string) {
  const linkSource = `data:${mimeType};base64,${base64Data}`;
  const downloadLink = document.createElement("a");
  downloadLink.href = linkSource;
  downloadLink.download = fileName;
  downloadLink.click();
}
```

---

## 📤 6. Export Employees

Export existing employee records to Excel or CSV.

#### `GET /api/v1/employees/bulk-export?format=xlsx&status=ACTIVE`
#### Query Parameters:
- `format`: `"xlsx"` (default) or `"csv"`
- `departmentId`: (optional) filter by department
- `branchId`: (optional) filter by branch
- `status`: (optional) `ACTIVE`, `INACTIVE`, `RESIGNED`, `TERMINATED`

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Employee export generated successfully",
  "data": {
    "fileName": "employees_export_1725785000000.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "fileData": "UEsDBBQAAAAIA...",
    "totalRecords": 148
  }
}
```

---

## 📋 7. Supported Spreadsheet Columns (Synonym Map)

Users do not need to follow strict column names! Any of the following synonyms are automatically recognized:

| Target Field | Accepted Column Headers in Sheet |
|---|---|
| **Full Name** | `Name`, `Employee Name`, `Full Name`, `Staff Name`, `Worker Name` |
| **First Name** | `First Name`, `FName`, `Given Name` |
| **Last Name** | `Last Name`, `LName`, `Surname`, `Family Name` |
| **Email** | `Official Mail ID`, `New Mail id`, `Work Email`, `Email Address`, `Email`, `Personal Mail ID` |
| **Employee Code** | `Emp Code`, `Employee Code`, `Emp ID`, `Staff ID`, `Worker ID`, `Employee Number` |
| **Branch / Office** | `Org Name`, `Branch`, `Office`, `Location`, `Work Location`, `Branch Name` |
| **Department** | `Department`, `Dept`, `Sub Department`, `Team` |
| **Designation** | `Designation`, `Title`, `Job Title`, `Role`, `Position` |
| **Date of Joining** | `DOJ`, `Date of Joining`, `Joining Date`, `Join Date`, `Start Date` |
| **Date of Birth** | `DOB`, `DOB (OFFICIAL)`, `DOB(Actual)`, `Date of Birth`, `Birth Date` |
| **Phone** | `Contact Number`, `Mobile`, `Phone`, `Cell`, `Alternate Contact No.` |
| **Gender** | `Gender`, `Sex` *(M / F / Male / Female / Other)* |
| **Status** | `Employee Status`, `Status` *(Active / InActive / Resigned / Terminated)* |
| **Aadhaar** | `Aadhar Card No.`, `Aadhaar`, `Aadhaar Number` *(supports scientific notation e.g. 6.66E+11)* |
| **PAN** | `Pan Card No.`, `PAN`, `PAN Number` |
| **Bank Account** | `Account Number`, `Bank Account Number`, `A/C No` *(auto-saved to bank accounts)* |
| **IFSC Code** | `IFSC Code`, `IFSC`, `Bank IFSC` |
| **Bank Name** | `Bank Name`, `Bank` |
| **Current Address** | `Current Address`, `Present Address`, `Address` |
| **Permanent Address** | `Permanent Address`, `Home Address` |
| **Emergency Contact**| `Father's Name`, `Father's Contact Number`, `Mother Name`, `Spouse Name` |
| **Highest Education**| `Highest Education`, `Qualification`, `Degree` |
| **Resignation / LWD**| `Last Working Day`, `LWD(Last Working Day)`, `Date of Resignation`, `Exit Date` |
| **Exit Reason** | `Reason of Resignation`, `Exit Reason`, `Leaving Reason` |

---

## 🎨 8. Suggested Frontend UI Components

### 1. Direct Import Modal
```
┌────────────────────────────────────────────────────────┐
│  Bulk Import Employees                                 │
├────────────────────────────────────────────────────────┤
│  📁 Drag & drop Excel (.xlsx) or CSV file here         │
│     or Browse Files                                    │
│                                                        │
│  ⚙️ Options:                                           │
│  [ ] Send welcome emails with login details            │
│      (Leave unchecked to import silently without spam) │
│                                                        │
│  ℹ️ Active employees will receive temporary password    │
│     "Welcome@2026" with forced change on first login.  │
│                                                        │
│  [Download Template]            [Cancel]  [Import Now] │
└────────────────────────────────────────────────────────┘
```

### 2. Success Banner (After Direct or Commit Import)
```
┌────────────────────────────────────────────────────────┐
│ ✅ 148 Employees Imported Successfully                 │
│                                                        │
│ 🔑 Temporary Password: Welcome@2026   [📋 Copy]        │
│ ⚠️ 2 records skipped due to missing names. [View Log]   │
└────────────────────────────────────────────────────────┘
```

---

## 🔒 9. Error Handling Guidelines

| HTTP Status | Error Case | Recommended User Action |
|---|---|---|
| `400 Bad Request` | Missing file buffer / corrupted file | Display alert: *"Please select a valid .xlsx or .csv spreadsheet."* |
| `400 Bad Request` | Zero valid rows found | Display modal with the list of validation errors from `response.data.errors`. |
| `403 Forbidden` | Workspace team size limit exceeded | Show Upgrade Plan modal: *"Bulk import exceeds your active user limit (max allowed: X). Please upgrade your subscription tier."* |
| `401 Unauthorized`| Expired / invalid JWT token | Redirect user to Login. |
