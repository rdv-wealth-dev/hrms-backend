# HRMS API Documentation & cURL Examples

This document serves as a guide for frontend developers integrating the HRMS backend.

All requests require the `Authorization: Bearer <token>` header.

> **Last Updated**: 2026-07-29  
> **Breaking Changes**: See ⚠️ sections below before integrating.

---

## 🔑 Base Configurations

- **Base URL**: `http://localhost:3000/api/v1` *(adjust for staging/production)*
- **Authentication**: Add `Authorization: Bearer YOUR_ACCESS_TOKEN` to all requests.

---

---

# 🎉 HOLIDAY CALENDAR APIs

---

## 🛠️ 1. Create a Holiday (`POST /leave/holidays`)

Create a holiday specifying its scope (GLOBAL, COUNTRY, STATE, BRANCH). Validation rules adjust dynamically based on scope.

### Case A: Branch-Scope Holiday
```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bangalore Office Local Day Off",
    "date": "2026-10-15",
    "type": "REGIONAL",
    "scope": "BRANCH",
    "isOptional": false,
    "branchId": "60d5ec49f1b2c52e40cd2a11",
    "description": "Specific holiday for Bangalore Tech Park employees"
  }'
```

### Case B: State-Scope Holiday
```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Karnataka Rajyotsava",
    "date": "2026-11-01",
    "type": "REGIONAL",
    "scope": "STATE",
    "isOptional": false,
    "countryCode": "IN",
    "stateCode": "Karnataka",
    "description": "State formation holiday for Karnataka branches"
  }'
```

### Case C: Country-Scope Holiday
```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Republic Day",
    "date": "2026-01-26",
    "type": "NATIONAL",
    "scope": "COUNTRY",
    "isOptional": false,
    "countryCode": "IN",
    "description": "National public holiday in India"
  }'
```

### Case D: Global-Scope Holiday
```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Global Company Foundation Day",
    "date": "2026-06-01",
    "type": "NATIONAL",
    "scope": "GLOBAL",
    "isOptional": false,
    "description": "Global company foundation day off"
  }'
```

---

## 🔍 2. List Holidays (`GET /leave/holidays`)

> **⚠️ CHANGED — Branch Scoping Now Enforced**
>
> **Before**: All users saw every holiday regardless of their branch.
>
> **After (New Behaviour)**:
> - **HQ / ORG_ADMIN** → sees **all holidays** across all scopes and branches (no change for them).
> - **Branch HR / Branch Admin** → sees:
>   - ✅ All `GLOBAL`, `COUNTRY`, `STATE` scope holidays (shared across the org)
>   - ✅ Only `BRANCH`-scope holidays belonging to **their own branch**
>   - ❌ Branch-scope holidays of **other branches are hidden**
>
> **No API change required on the frontend** — the same endpoint now returns the correct filtered set based on the caller's token role.

```bash
curl -X GET "http://localhost:3000/api/v1/leave/holidays?year=2026" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🔍 3. Resolve Holidays for a Branch (`GET /leave/holidays/resolve`)

Returns the fully resolved, deduplicated, priority-merged (BRANCH > STATE > COUNTRY > GLOBAL) yearly holiday calendar for a specific branch.

- `branchId` — required, 24-char ObjectId
- `year` — optional, defaults to current year

```bash
curl -X GET "http://localhost:3000/api/v1/leave/holidays/resolve?branchId=60d5ec49f1b2c52e40cd2a11&year=2026" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response:
```json
{
  "success": true,
  "message": "Resolved holidays fetched successfully",
  "data": [
    {
      "_id": "60d5ec49f1b2c52e40cd2a12",
      "name": "Republic Day",
      "date": "2026-01-26T00:00:00.000Z",
      "scope": "COUNTRY",
      "isOptional": false,
      "description": "Statutory National Holiday for IN",
      "branchId": null,
      "countryCode": "IN",
      "stateCode": null,
      "type": "NATIONAL"
    }
  ]
}
```

---

## 📅 4. Branch Monthly Calendar (`GET /branches/:branchId/calendar`)

Returns a monthly calendar with days mapped as `WORKING`, `WEEK_OFF`, or `HOLIDAY`. Also includes employee events (birthdays/anniversaries).

```bash
curl -X GET "http://localhost:3000/api/v1/branches/60d5ec49f1b2c52e40cd2a11/calendar?year=2026&month=11" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 👤 5. Personal Schedule — Rotation-Aware (`GET /branches/me/schedule`)

Returns the monthly, rotation-aware personal schedule for the calling employee.

```bash
curl -X GET "http://localhost:3000/api/v1/branches/me/schedule?year=2026&month=11" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🏢 6. Branch APIs

### Get All Branches (`GET /branches`)
Returns all branches for the tenant. HQ sees all; Branch HR sees based on their assignment.
```bash
curl -X GET "http://localhost:3000/api/v1/branches" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Head Office (`GET /branches/head-office`)
Returns the single branch marked as `isHeadOffice: true`.
```bash
curl -X GET "http://localhost:3000/api/v1/branches/head-office" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## ✏️ 7. Update a Holiday (`PATCH /leave/holidays/:id`)

```bash
curl -X PATCH http://localhost:3000/api/v1/leave/holidays/60d5ec49f1b2c52e40cd2a12 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Republic Day - Parade Celebration",
    "description": "Updated description for India parade celebrations"
  }'
```

---

## ❌ 8. Delete a Holiday (`DELETE /leave/holidays/:id`)

```bash
curl -X DELETE http://localhost:3000/api/v1/leave/holidays/60d5ec49f1b2c52e40cd2a12 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🌱 9. Seed Default Statutory Holidays (`POST /leave/holidays/seed-default`)

> **⚠️ BREAKING CHANGE — `countryCode` query param removed**
>
> **Before**: You could pass `?countryCode=US` to seed holidays for any country manually.
> ```bash
> # OLD — no longer works, countryCode is ignored
> POST /leave/holidays/seed-default?countryCode=US
> ```
>
> **After**: Country code is **always and only derived from the Organization's registered locale** (set during org registration). You cannot override it via query param anymore.
>
> - ✅ `?stateCode=KA` is still accepted to seed state-level holidays.
> - ❌ `?countryCode=XX` is silently ignored (the org's country is always used).
> - 🚫 If the org has **no country code configured**, the API returns `400` with a message to configure it in Organization Settings first.

### Seed for Org's Registered Country
```bash
curl -X POST "http://localhost:3000/api/v1/leave/holidays/seed-default" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Seed Including State-Level Holidays (e.g. Karnataka)
```bash
curl -X POST "http://localhost:3000/api/v1/leave/holidays/seed-default?stateCode=KA" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Success Response:
```json
{
  "success": true,
  "message": "Statutory holidays for IN seeded successfully",
  "data": null
}
```

### Expected Error — No Country Configured:
```json
{
  "success": false,
  "message": "Organization has no country code configured. Please set a country code in your Organization settings first.",
  "statusCode": 400
}
```

---

---

# 👥 LEAVE MANAGEMENT APIs

---

## 📋 10. Leave Requests — Employee Profile Picture Now Included

> **✅ NEW — `avatarUrl` and `profilePicture` fields now returned**
>
> All leave request list and detail responses now include the employee's profile picture fields inside the `employeeId` object. No frontend API call change needed — just map the new fields.

### Affected Endpoints:
| Endpoint | What Changed |
|---|---|
| `GET /leave/requests` (My Requests) | `employeeId.avatarUrl` + `employeeId.profilePicture` now populated |
| `GET /leave/requests/pending` (Approval Queue) | Same |
| `GET /leave/requests/:id` (Detail) | Same |
| `POST /leave/requests` (Create — response) | Same |
| `GET /leave/requests/report` (Report view) | Same |

### How to Use in Frontend:
```json
{
  "employeeId": {
    "_id": "...",
    "employeeCode": "EMP-0012",
    "firstName": "Harish",
    "lastName": "Soni",
    "avatarUrl": "https://storage.example.com/avatars/emp-0012.jpg",
    "profilePicture": "https://storage.example.com/profile/emp-0012.jpg"
  }
}
```

Display logic suggestion:
```javascript
// Use avatarUrl first, fall back to profilePicture, then initials
const avatarSrc = employee.avatarUrl || employee.profilePicture || null;
```

---

---

# ⏱️ ATTENDANCE MANAGEMENT APIs

---

## 🧮 11. Attendance Status Thresholds — Now Shift-Driven

> **✅ CHANGED — Thresholds no longer hardcoded**
>
> **Before**: Attendance status thresholds were hardcoded:
> - ABSENT if check-in > 255 minutes after shift start
> - HALF_DAY if check-in > 90 minutes after shift start
>
> **After**: These are now configurable **per shift** via two new fields in the Shift schema:

| Field | Default | Meaning |
|---|---|---|
| `absentThresholdMinutes` | `255` | Minutes late → marked ABSENT |
| `lateArrivalHalfDayMinutes` | `90` | Minutes late → marked HALF_DAY |

### Example: Create/Update Shift with Custom Thresholds
```bash
curl -X PATCH http://localhost:3000/api/v1/attendance/shifts/SHIFT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "absentThresholdMinutes": 180,
    "lateArrivalHalfDayMinutes": 60
  }'
```

With the above config:
- Employee checking in **> 60 min late** → `HALF_DAY`
- Employee checking in **> 180 min late** → `ABSENT`

> **No frontend UI change needed** unless you plan to expose these fields in a Shift Settings form (recommended for HR admin).

---

## 🕐 12. Overtime Auto-Computation on Checkout

> **✅ NEW — OT is now automatically triggered on each punch checkout**
>
> When an employee punches CHECK_OUT or an HR records a Manual Entry, the backend automatically:
> 1. Calls `OvertimeService.computeForDay()` for that employee and date.
> 2. Links the computed `overtimeId` back to the attendance record.
>
> **Frontend impact**: The attendance record's `overtimeId` field will now be populated after checkout. You can use this to show an "OT Computed" badge on the attendance detail view without a separate API call.

### Check Attendance Record (OT Link Example):
```bash
curl -X GET "http://localhost:3000/api/v1/attendance/ATTENDANCE_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

```json
{
  "data": {
    "_id": "...",
    "employeeId": "...",
    "attendanceDate": "2026-07-29",
    "workedMinutes": 540,
    "status": "PRESENT",
    "overtimeId": "66f3a1b2c8e4d2f1a0b3c4d5"
  }
}
```

---

---

# 💰 PAYROLL APIs

---

## 🔒 13. Attendance Lock Required Before Payroll Run

> **⚠️ NEW PRE-FLIGHT CHECK**
>
> Payroll run (`POST /payroll/run`) now **blocks** if the attendance period is not locked first.
> Lock attendance before generating payslips.

### Lock Attendance Period
```bash
curl -X POST http://localhost:3000/api/v1/payroll/attendance-lock/lock \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "month": 7
  }'
```

### Unlock Attendance Period (requires reason)
> Note: Unlock is **blocked** if payroll has already been paid for that period.
```bash
curl -X POST http://localhost:3000/api/v1/payroll/attendance-lock/unlock \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "month": 7,
    "reason": "Correction required for 3 employees"
  }'
```

---

## ✅ 14. Maker-Checker — Self-Approval Blocked

> **⚠️ BREAKING BEHAVIOUR**
>
> The user who **creates** a payroll run **cannot approve it**.
> Attempting self-approval returns `403 Forbidden`.
>
> **Workflow**:
> 1. Clerk A → `POST /payroll/run` (creates DRAFT)
> 2. Manager B → `POST /payroll/run/:id/approve` (approves)
> 3. Clerk A attempting step 2 → **403 Forbidden**

---

## 🧾 15. Run Payroll (`POST /payroll/run`)

```bash
curl -X POST http://localhost:3000/api/v1/payroll/run \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "month": 7,
    "branchId": "60d5ec49f1b2c52e40cd2a11"
  }'
```

### Error — Attendance Not Locked:
```json
{
  "success": false,
  "message": "Attendance for July 2026 must be locked before running payroll.",
  "statusCode": 422
}
```

---

## ✅ 16. Approve Payroll Run (`POST /payroll/run/:id/approve`)

```bash
curl -X POST http://localhost:3000/api/v1/payroll/run/PAYROLL_RUN_ID/approve \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Error — Self-Approval Attempt:
```json
{
  "success": false,
  "message": "The person who created this payroll run cannot approve it.",
  "statusCode": 403
}
```

---

---

# 📌 Quick Reference — What Changed

| Module | Change | Impact on Frontend |
|---|---|---|
| **Holidays - List** | Branch HR only sees their own branch holidays | No code change — response is already filtered |
| **Holidays - Seed** | `?countryCode` param removed; always uses org locale | Remove that param from Seed Defaults UI |
| **Holidays - Seed** | 400 error if org has no country code | Show error message from API response |
| **Leave Requests** | `avatarUrl` + `profilePicture` now in employee populate | Map `employeeId.avatarUrl` for profile pictures |
| **Attendance** | Shift-driven absent/half-day thresholds | Optional: expose fields in Shift Settings form |
| **Attendance** | `overtimeId` linked after checkout | Show "OT Computed" badge if `overtimeId` is set |
| **Payroll** | Attendance must be locked before payroll run | Add Lock step to payroll workflow UI |
| **Payroll** | Creator cannot self-approve | Show approval button only to non-creator managers |
