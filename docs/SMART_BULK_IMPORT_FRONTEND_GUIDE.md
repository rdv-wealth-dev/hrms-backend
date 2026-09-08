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

---

## 🔐 10. First-Time Login & Forced Password Change Flow (Frontend Implementation)

Here is the exact step-by-step logic and API contracts for how newly imported employees log in for the first time and set their own password.

### 🔄 Flow Diagram
```
Import Finished
   ↓
HR shares: "Welcome@2026" (or internal memo)
   ↓
Employee goes to Login Screen
   ↓
POST /api/v1/auth/login { email, password: "Welcome@2026" }
   ↓
Backend Response: requiresPasswordReset = true
   ↓
Frontend checks: if (data.requiresPasswordReset)
   ├── Store accessToken & refreshToken
   └── Redirect immediately to: /change-password (Force Screen)
   ↓
Employee enters:
   - Current Password: "Welcome@2026"
   - New Password: "MySecretPassword@2026"
   - Confirm Password: "MySecretPassword@2026"
   ↓
POST /api/v1/auth/change-password
   ↓
Backend sets: user.requiresPasswordReset = false
   ↓
Frontend redirects to: /dashboard (Full Access Granted 🎉)
```

---

### Step A: Employee Logs In
#### `POST /api/v1/auth/login`
#### Request Payload
```json
{
  "email": "faiz@redvisiontech.com",
  "password": "Welcome@2026"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "requiresPasswordReset": true,
    "onboardingCompleted": true,
    "user": {
      "id": "66dd8f72a420658428d0001",
      "email": "faiz@redvisiontech.com",
      "firstName": "Faiz",
      "lastName": "Ahmad Khan",
      "role": "EMPLOYEE"
    }
  }
}
```

---

### Step B: Frontend Auth State / Router Guard Example
```typescript
// Login Handler in React / Next.js
async function handleLogin(credentials) {
  const res = await axios.post("/api/v1/auth/login", credentials);
  const { accessToken, refreshToken, requiresPasswordReset } = res.data.data;

  // 1. Store tokens
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);

  // 2. Intercept forced password reset
  if (requiresPasswordReset) {
    // Redirect to forced password change screen (block dashboard access)
    navigate("/auth/change-password?firstTime=true");
    return;
  }

  // 3. Normal login -> proceed to dashboard
  navigate("/dashboard");
}
```

---

### Step C: Employee Sets Their Own Password
#### `POST /api/v1/auth/change-password`

#### Headers
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

#### Request Payload
```json
{
  "currentPassword": "Welcome@2026",
  "newPassword": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```

#### Validation Rules for `newPassword`:
- Minimum **8 characters**
- Must contain at least 1 uppercase letter (`A-Z`)
- Must contain at least 1 lowercase letter (`a-z`)
- Must contain at least 1 number (`0-9`)
- Must contain at least 1 special character (e.g. `@$!%*?&#`)
- `confirmPassword` must match `newPassword`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "message": "Password changed successfully"
  }
}
```

> [!TIP]
> After this request succeeds, backend automatically updates `user.requiresPasswordReset = false`. Frontend should show a toast: *"Password updated successfully! Welcome to HRMS."* and navigate to `/dashboard`.

---

## 👥 11. Ex-Employees & Inactive Records — Complete Frontend UX Guide

When HR imports an existing company sheet, it usually contains **both current active staff and past ex-employees** (resigned, terminated, contract ended). Here is exactly how the frontend must handle them to ensure a clean, professional user experience.

### 🗂️ 1. Directory Tabs Recommendation
Do **not** mix active and inactive employees in one table by default. Provide clear tab filters in the Employee Directory:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ Active Workforce (142) ]   [ Ex-Employees / Resigned (68) ]   [ All ]│
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search by name, code, dept...     Filter: [ Department ▼ ] [ Branch ▼ ] │
└────────────────────────────────────────────────────────────────────────┘
```

#### API Calls for Tabs:
- **Active Workforce Tab:**
  ```http
  GET /api/v1/employees?status=ACTIVE&pageNumber=1&pageSize=20
  ```
- **Ex-Employees / Resigned Tab:**
  ```http
  GET /api/v1/employees?status=RESIGNED&pageNumber=1&pageSize=20
  ```
  *(Or filter by `status=INACTIVE` / `status=TERMINATED` via a sub-dropdown)*
- **All Records Tab:**
  ```http
  GET /api/v1/employees?pageNumber=1&pageSize=20
  ```

---

### 🏷️ 2. Status Badges & Color Scheme
Use distinct visual badges in your table and profile headers:

| Status Value | Meaning | Recommended Badge Style |
|---|---|---|
| `ACTIVE` | Currently working | 🟢 `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `ON_LEAVE` | Active, on extended leave | 🟡 `bg-amber-50 text-amber-700 border-amber-200` |
| `RESIGNED` | Left company voluntarily | ⚪ `bg-slate-100 text-slate-700 border-slate-300` |
| `TERMINATED` | Relieved / terminated | 🔴 `bg-rose-50 text-rose-700 border-rose-200` |
| `INACTIVE` | Other inactive status | ⚪ `bg-gray-100 text-gray-600 border-gray-200` |

---

### 🆔 3. Employee Code Display for Ex-Employees
There are two kinds of employee codes for ex-employees:
1. **Preserved Historical Codes:** If the Excel sheet had a code (e.g. `20120813F10001` or `OLD-104`), the backend preserves it as-is. Show a secondary tag:  
   `20120813F10001` <span style="font-size:10px; color:#888;">(Historical)</span>
2. **Auto-Generated Archive Codes:** If the Excel sheet had **no code**, the backend assigns:  
   **`RVG-EX-001`**, **`RVG-EX-002`**, etc. Show this code clearly so HR can identify it as an archived entry.

---

### 📧 4. Archive Email Handling in UI
If an inactive employee had no email in the spreadsheet, the backend assigns a synthetic identifier:  
`rvg-ex-001@archive.local` (needed solely for internal database integrity).

> [!IMPORTANT]
> **Frontend Rule for Emails:**  
> If `employee.email` ends with `@archive.local`, **do not display this fake email to the user**.  
> Display: `—` (dash) or a badge: *"No Email on File"*.

```typescript
function formatEmployeeEmail(email?: string): string {
  if (!email || email.endsWith("@archive.local")) {
    return "—";
  }
  return email;
}
```

---

### 🚫 5. Disabled / Hidden Actions for Ex-Employees
In the employee table action menu (the `...` three-dots menu) and profile page:

| Action | Active Employee | Ex-Employee (`RESIGNED` / `INACTIVE`) |
|---|---|---|
| **View Full Profile** | ✅ Allowed | ✅ Allowed (View historical records) |
| **Download Relieving / Experience Letter** | ❌ (Usually for ex) | ✅ Allowed |
| **Full & Final Settlement (FnF)** | ❌ | ✅ Allowed |
| **Send Login Credentials / Reset Email** | ✅ Allowed | 🚫 **HIDE / DISABLE** (No login account exists!) |
| **Mark Daily Attendance** | ✅ Allowed | 🚫 **HIDE / DISABLE** |
| **Include in Monthly Payroll Cycle** | ✅ Allowed | 🚫 **HIDE / DISABLE** |
| **Edit Role / Assign Reporting Manager** | ✅ Allowed | 🚫 **HIDE / DISABLE** |

---

### 📄 6. Sample Ex-Employee Record Returned by API
When fetching an ex-employee (`GET /api/v1/employees/:id` or `GET /api/v1/employees?status=RESIGNED`):

```json
{
  "_id": "66dd8f72a420658428d0005",
  "employeeCode": "RVG-EX-001",
  "firstName": "Arpit",
  "lastName": "Jain",
  "email": "arpit@redvisiontech.com",
  "phone": "9993140310",
  "status": "RESIGNED",
  "isActive": false,
  "joiningDate": "2012-08-13T00:00:00.000Z",
  "exitDate": "2024-05-31T00:00:00.000Z",
  "exitReason": "For better Opportunity",
  "department": { "name": "Sales" },
  "designation": { "name": "Team Leader - Sales" },
  "branch": { "name": "Indore Head Office" },
  "gender": "MALE",
  "bloodGroup": "O+",
  "maritalStatus": "MARRIED",
  "pan": "APIPJ5886N",
  "aadhaar": "666000000000",
  "emergencyContacts": [
    {
      "name": "Shri Rajkumar Jain",
      "relationship": "Father",
      "phone": "9993663646"
    }
  ],
  "bankAccounts": [
    {
      "bankName": "HDFC Bank",
      "accountNumber": "50100012345678",
      "ifscCode": "HDFC0000036",
      "accountType": "SALARY"
    }
  ]
}
```

---

## ➕ 12. Manual Employee Creation & Counter Guarantee ("+ Add Employee")

When HR adds a new active employee via the manual form (`POST /api/v1/employees`):

1. **Frontend does NOT need to supply an employee code.**  
   The backend automatically calculates the next sequential code (`getNextEmployeeCode`).
2. **Guaranteed Gap-Free & Collision-Free:**  
   Because the bulk import synced the counter to the highest active imported code (e.g. `RVG150`), and inactive employees without codes were routed to `RVG-EX-001`:
   - The very next employee added via UI is guaranteed to receive: **`RVG151`**.
   - No duplicate key errors.
   - No sequence jumping.

---

## 📑 13. Sub-Documents & Auto-Extracted Data (Profile View)

When viewing an imported employee's profile, the frontend can display data that was previously ignored by older imports:

### 1. Bank Details (`GET /api/v1/employees/:id/bank-accounts`)
Automatically populated from sheet columns (`Account Number`, `IFSC Code`, `Bank Name`).
- Display in the **"Banking & Payroll"** tab of the profile.
- Shows primary salary bank account with masked account number (e.g. `••••••••5678`).

### 2. Emergency Contacts (`employee.emergencyContacts`)
Automatically populated from sheet columns:
- `Father's Name` + `Father Contact` ➔ `{ name, relationship: "Father", phone }`
- `Mother Name` + `Mother Contact` ➔ `{ name, relationship: "Mother", phone }`
- `Spouse Name` + `Spouse Contact` ➔ `{ name, relationship: "Spouse", phone }`

### 3. Addresses (`employee.currentAddress`, `employee.permanentAddress`)
Extracted from `Current Address` and `Permanent Address` columns.

### 4. Education (`employee.educationDetails`)
Populated from `Highest Education` column (e.g. `BE`, `B.Com`, `MBA`).

---

## 📧 14. Email Notification Control & Zero-Spam Strategy (UI Implementation)

A common fear of HR admins during bulk import is:  
> *"If I upload a sheet with 200 employees right now, will the system suddenly spam 200 welcome emails into everyone's inbox before we are even ready?"*

The answer is **NO**. By default, the system imports **100% silently with ZERO emails**. Here is how the frontend developer must implement this control.

---

### 🎛️ 1. UI Checkbox Design
In the Bulk Import modal or wizard commit screen, provide a checkbox that is **UNCHECKED by default**:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Import Options                                                        │
│                                                                        │
│  [ ] Send welcome emails with login credentials                        │
│      ℹ️ Leave unchecked (recommended) to import silently. Active       │
│         employees can log in using default password "Welcome@2026"     │
│         and will be prompted to set their own password on first login. │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 📤 2. How Frontend Sends the Parameter

#### A. In Direct Import (`POST /api/v1/employees/bulk-import` — `multipart/form-data`):
```typescript
const formData = new FormData();
formData.append("file", selectedFile);
// Explicitly pass boolean (or omit to let backend default to false)
formData.append("sendWelcomeEmail", String(sendWelcomeEmail)); // "false" or "true"
```

#### B. In Wizard Commit (`POST /api/v1/employees/import/:sessionId/commit` — `application/json`):
```json
{
  "sendWelcomeEmail": false,
  "defaultPassword": "Welcome@2026"
}
```

---

### 🔄 3. Backend Response Behavior Based on Checkbox

The backend adjusts its response based on `sendWelcomeEmail`:

| Scenario | `sendWelcomeEmail` | Emails Sent | Returned `defaultPassword` | What Frontend Must Show |
|---|---|---|---|---|
| **Default (Recommended)** | `false` | **0 Emails** (Silent) | `"Welcome@2026"` | Show green success banner with **Copy Password button** so HR can share it internally via Slack/WhatsApp/memo. |
| **Explicit Opt-in** | `true` | **Emails Sent** to active employees | `undefined` | Show message: *"Welcome emails with account setup instructions have been sent to all active employees."* |

#### Sample Response when `sendWelcomeEmail = false` (Default):
```json
{
  "success": true,
  "message": "Bulk import processed successfully",
  "data": {
    "totalProcessed": 150,
    "insertedCount": 148,
    "failedCount": 2,
    "defaultPassword": "Welcome@2026"
  }
}
```
👉 Notice `defaultPassword: "Welcome@2026"` is present.

#### Sample Response when `sendWelcomeEmail = true`:
```json
{
  "success": true,
  "message": "Bulk import processed successfully",
  "data": {
    "totalProcessed": 150,
    "insertedCount": 148,
    "failedCount": 2,
    "defaultPassword": null
  }
}
```
👉 Notice `defaultPassword` is omitted because users got their email directly.

---

### 🚫 4. Ex-Employees / Inactive Records: Always ZERO Emails
Regardless of whether the HR admin checks the box or leaves it unchecked:
- **Ex-employees / Resigned employees NEVER receive any email.**
- The backend completely skips account creation and email sending for inactive records:
  ```typescript
  if (!isActive || !emp.email || emp.email.endsWith("@archive.local")) continue;
  ```
- Ex-employees are preserved safely in the database without any risk of getting unwanted emails.

---

### 💻 5. Complete React Component Example

```tsx
import React, { useState } from "react";
import axios from "axios";

export function BulkImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState<File | null>(null);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState<boolean>(false); // DEFAULT FALSE!
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sendWelcomeEmail", String(sendWelcomeEmail));

    try {
      const res = await axios.post("/api/v1/employees/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data.data);
      if (onSuccess) onSuccess(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-container">
      <h3>Bulk Import Employees</h3>

      {!result ? (
        <>
          <input 
            type="file" 
            accept=".xlsx,.csv" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />

          {/* EMAIL CONTROL CHECKBOX - DEFAULT FALSE */}
          <div className="checkbox-group" style={{ margin: "16px 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={sendWelcomeEmail}
                onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Send welcome emails with login credentials</span>
            </label>
            <p style={{ fontSize: "12px", color: "#666", margin: "4px 0 0 24px" }}>
              Leave unchecked to import silently without emailing employees. Active employees can log in with temporary password "Welcome@2026" and will be forced to change it on first login.
            </p>
          </div>

          <button onClick={handleUpload} disabled={!file || isLoading}>
            {isLoading ? "Importing..." : "Upload & Import"}
          </button>
        </>
      ) : (
        <div className="success-banner">
          <h4>✅ {result.insertedCount} Employees Imported</h4>
          
          {/* If silent import, show temporary password to HR */}
          {result.defaultPassword && (
            <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "6px", margin: "12px 0" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#166534" }}>
                Temporary Password for Active Users: <strong>{result.defaultPassword}</strong>
              </p>
              <button onClick={() => navigator.clipboard.writeText(result.defaultPassword)}>
                Copy Password
              </button>
            </div>
          )}

          <button onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  );
}
```

---

## 🏁 15. Summary Checklist for Frontend Developer

- [ ] **Import Modal:** Add file uploader supporting `.xlsx` and `.csv`.
- [ ] **Email Checkbox:** Add `[ ] Send welcome emails` checkbox (**default: unchecked / false**).
- [ ] **Success Banner:** When `result.defaultPassword` is returned, show copyable password banner (`Welcome@2026`).
- [ ] **Login Interceptor:** If login response has `requiresPasswordReset: true`, redirect immediately to `/auth/change-password`.
- [ ] **Change Password Form:** Wire to `POST /api/v1/auth/change-password` with standard 8+ char regex validation.
- [ ] **Directory Tabs:** Filter Active (`?status=ACTIVE`) vs Resigned (`?status=RESIGNED`).
- [ ] **Ex-Employee Actions:** Hide/disable "Send Credentials", "Mark Attendance", and "Monthly Payroll" for inactive/resigned staff.
- [ ] **Archive Email:** If email ends with `@archive.local`, render `—` (dash) instead of showing the synthetic address.
- [ ] **Sub-Documents:** Display auto-extracted bank account, emergency contacts, addresses, and education in the employee profile tabs.

