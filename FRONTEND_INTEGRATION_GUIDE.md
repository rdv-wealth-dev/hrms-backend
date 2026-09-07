# HRMS Frontend Integration Guide & Smart Master Data Architecture

> **Target Audience**: Frontend Engineering Team  
> **Last Updated**: September 2026  
> **Base URL**: `/api/v1`

---

## 📌 Executive Summary of Updates

To eliminate cluttered dropdowns, unused shifts, and irrelevant leave types for new tenants, the backend has been upgraded with **Smart Master Data Tailoring**:

1. **Signup (Step 1)**: Do **NOT** send `industry: ""` in signup. Industry is collected in Step 2.
2. **Setup Wizard (Step 2)**: Now supports **smart selectable departments**, **working style presets**, and **leave policy tiers**.
3. **Smart Leave Visibility**: Only core leaves are active by default. Specialized leaves (Maternity, Paternity, Marriage, etc.) are kept in the template drawer and can be toggled on demand.
4. **1-Click Master Data Cleanup**: Added `DELETE /api/v1/departments/cleanup/unused` to remove all unassigned departments & designations anytime.

---

## 1. Step 1: Workspace Registration (`POST /api/v1/auth/register`)

### ⚠️ Critical Frontend Action:
* Remove `industry: ""` from the registration form state and payload!
* Do not send `countryCode` or `timezone` here (they are collected in Step 2).

### Request Payload:
* **Endpoint**: `POST /api/v1/auth/register`
* **Access**: Public

```json
{
  "companyName": "Redvision Global Pvt Ltd",
  "workspaceSlug": "redvisionglobalpvtltd",
  "firstName": "Zahiruddin",
  "lastName": "Babar",
  "email": "zahirbabbar@mailinator.com",
  "phone": "9879789879",
  "password": "AdminPassword123!",
  "employeeCountRange": "201-500"
}
```

### Success Response (`201 Created`):
```json
{
  "succeeded": true,
  "message": "Company registered successfully",
  "data": {
    "message": "Registration successful! Please check your email to verify your account before logging in.",
    "organization": {
      "id": "66c3a1b2e84129a1b8921a01",
      "companyName": "Redvision Global Pvt Ltd",
      "slug": "redvision-global-pvt-ltd",
      "workspaceSlug": "redvisionglobalpvtltd",
      "workspaceUrl": "https://redvisionglobalpvtltd.yourhrms.com",
      "onboardingCompleted": false,
      "onboardingStatus": "step1_completed"
    }
  }
}
```

---

## 2. Step 2: Mandatory Setup Wizard (`POST /api/v1/auth/complete-onboarding`)

After verifying email and logging in (`POST /api/v1/auth/login`), if `onboardingCompleted: false`, redirect the Org Admin to the **Setup Wizard**.

### Request Payload:
* **Endpoint**: `POST /api/v1/auth/complete-onboarding`
* **Headers**: `Authorization: Bearer <accessToken>`

```json
{
  "countryCode": "IN",
  "timezone": "Asia/Kolkata",
  "industry": "Technology",
  "employeeCountRange": "201-500",
  "baseCurrency": "INR",
  "fiscalYearStart": "April",
  "workingStyle": "regular",
  "leavePolicy": "standard",
  "selectedDepartments": ["ENG", "HR", "FIN", "PM", "UIX"]
}
```

### Field Breakdown & Smart Presets:

| Field | Type | Required? | Description & Values |
| :--- | :--- | :---: | :--- |
| `countryCode` | `string` | **Yes** | ISO 2-letter country code (e.g., `"IN"`, `"AE"`, `"US"`). |
| `timezone` | `string` | **Yes** | IANA timezone (e.g., `"Asia/Kolkata"`, `"Asia/Dubai"`). |
| `industry` | `string` | **Yes** | Industry name (e.g., `"Technology"`, `"Manufacturing"`, `"Healthcare"`, `"Retail"`). |
| `workingStyle` | `string` | No | • `"regular"` *(Default)*: Seeds only **General Shift (9 AM - 6 PM)**.<br>• `"flexible"`: Seeds General + Flexible Shift.<br>• `"rotational"`: Seeds 5 shifts (General, Flexible, Morning, Afternoon, Night). |
| `leavePolicy` | `string` | No | • `"standard"` *(Default)*: Activates **Casual, Sick, Annual/Privilege, Loss of Pay** (Specialized leaves kept in template drawer).<br>• `"all"`: Activates all 9 leave types.<br>• `"minimal"`: Activates only Annual Leave and Loss of Pay. |
| `selectedDepartments` | `string[]` | No | Array of department codes user picked via tag selector. If omitted, backend auto-selects based on `industry`! |

### Success Response (`200 OK`):
```json
{
  "succeeded": true,
  "message": "Workspace configured successfully.",
  "data": {
    "message": "Workspace configured successfully.",
    "onboardingCompleted": true,
    "onboardingStatus": "completed"
  }
}
```

---

## 3. Department Codes Master Reference (For Tag/Pill Selector)

Show these in your UI as clickable pill badges with checkboxes:

```
[✔ Human Resources (HR)]    [✔ Finance & Accounts (FIN)]   [✔ Operations (OPS)]
[✔ Software Eng (ENG)]      [  Product Mgmt (PM)]          [  Design / UI-UX (UIX)]
[  Quality Assurance (QA)]  [  DevOps & Cloud (DEVOPS)]    [  Cybersecurity (SEC)]
[  Data & Analytics (DATA)] [  IT Support (ITSUP)]         [  Administration (ADMIN)]
```

| Department Code | Full Department Name | Typical Industry |
| :--- | :--- | :--- |
| `ADMIN` | Administration & Facilities | Universal / All |
| `HR` | Human Resources | Universal / All |
| `FIN` | Finance & Accounts | Universal / All |
| `OPS` | Operations & Logistics | Universal / Services / Manufacturing |
| `ENG` | Software Engineering | Technology / SaaS |
| `PM` | Product Management | Technology / Digital |
| `UIX` | UI/UX & Product Design | Technology / Creative |
| `QA` | Quality Assurance | Technology / Manufacturing |
| `DEVOPS` | Cloud & Infrastructure | Technology |
| `SEC` | Cybersecurity | Technology / Finance |
| `DATA` | Data & Analytics | Technology / Enterprise |
| `ITSUP` | IT Support & Helpdesk | Corporate / Enterprise |

> **Pro Tip**: Designations are **automatically filtered**! If the user only picks `ENG` and `HR`, only Engineering and HR designations will be created. No empty/irrelevant designations will clutter dropdowns.

---

## 4. Smart Shift Selector in Frontend

In Step 2 of the Wizard, render a simple 3-card radio selector for **Working Style**:

```
What is your company's working style?

🔘 Regular Office Hours (Recommended)
   Standard 9:00 AM - 6:00 PM shift. Best for corporate offices and startups.
   [ Payload: "workingStyle": "regular" ]

🔘 Flexible Hours
   Core hours with arrival flexibility (9 AM - 6 PM & 11 AM - 8 PM).
   [ Payload: "workingStyle": "flexible" ]

🔘 24/7 Rotational Shifts
   Three rotational shifts (Morning 6 AM, Afternoon 2 PM, Night 10 PM).
   Best for manufacturing plants, call centers, and hospitals.
   [ Payload: "workingStyle": "rotational" ]
```

---

## 5. Smart Leaves: Gender & Marital Status Filtering

The backend provides all leave types via `GET /api/v1/leave/types` or employee balances via `GET /api/v1/leave/balances/me`.

### Frontend Dropdown Filter Logic on "Apply Leave" Modal:
When an employee applies for leave, the frontend should filter out irrelevant leaves based on the logged-in employee's profile:

```typescript
// Sample Frontend Filter Function
function getVisibleLeaveTypes(leaveTypes, currentUser) {
  return leaveTypes.filter((leave) => {
    // 1. Only show active leave types
    if (!leave.isActive) return false;

    // 2. Hide Maternity Leave for male employees
    if (leave.code === "ML" && currentUser.gender?.toUpperCase() === "MALE") {
      return false;
    }

    // 3. Hide Paternity Leave for female employees
    if (leave.code === "PAT" && currentUser.gender?.toUpperCase() === "FEMALE") {
      return false;
    }

    // 4. Hide Marriage Leave for already married employees
    if (leave.code === "MAR" && currentUser.maritalStatus?.toUpperCase() === "MARRIED") {
      return false;
    }

    // 5. Hide Compensatory Off if available balance is 0
    if (leave.code === "COMP_OFF" && (leave.availableDays ?? 0) <= 0) {
      return false;
    }

    return true;
  });
}
```

---

## 6. Admin 1-Click Master Data Cleanup API

If an existing organization already has unused departments and designations from old seeds, provide a button in **Settings > Departments**:

> 💡 **"Clean Up Unused Departments & Designations"**  
> *"Automatically archives all departments and designations that currently have 0 assigned employees."*

### API Request:
* **Endpoint**: `DELETE /api/v1/departments/cleanup/unused`
* **Headers**: `Authorization: Bearer <accessToken>` (Requires Admin role)

### Success Response (`200 OK`):
```json
{
  "succeeded": true,
  "message": "Unused master data cleaned up successfully",
  "data": {
    "message": "Unused master data cleaned up successfully",
    "departmentsCleaned": 7,
    "designationsCleaned": 42,
    "activeDepartmentsInUse": 4,
    "activeDesignationsInUse": 8
  }
}
```

---

## 7. Ready-to-Send Message for Frontend Developer

Copy and paste this message directly to your frontend developer:

```markdown
Hi Team,

We have updated the backend to support Smart Master Data setup and eliminate cluttered dropdowns:

1. Signup (POST /api/v1/auth/register):
   - Please remove `industry: ""` from the registration form state.
   - Only send: companyName, workspaceSlug, firstName, lastName, email, phone, password, employeeCountRange.
   - Industry is collected in Step 2 (Onboarding Wizard).

2. Onboarding Wizard (POST /api/v1/auth/complete-onboarding):
   - Now supports new optional controls:
     • `workingStyle`: "regular" (default, 9-6 shift) | "flexible" | "rotational" (24/7 shifts).
     • `leavePolicy`: "standard" (default, everyday leaves active) | "all" | "minimal".
     • `selectedDepartments`: Array of department codes e.g. ["ENG", "HR", "FIN"].
       (Only designations for selected departments will be created!).

3. Leave Application Dropdown:
   - On the "Apply Leave" modal, please apply smart client filtering:
     • Hide Maternity Leave if employee gender is Male.
     • Hide Paternity Leave if employee gender is Female.
     • Hide Marriage Leave if employee is already Married.

4. Unused Master Data Cleanup:
   - Admins can now clean up empty departments with 1-click via:
     DELETE /api/v1/departments/cleanup/unused

Complete payloads and field tables are documented in `FRONTEND_INTEGRATION_GUIDE.md` in the repo.
```
