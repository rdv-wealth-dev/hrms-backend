# 🔄 HRMS Backend Update Notes
**Date**: 2026-07-29  
**For**: Frontend Developers

---

## 1. 🌿 Leave Management — Employee Profile Picture

### What Changed
All leave request API responses now include `avatarUrl` and `profilePicture` inside the `employeeId` object.

### Affected Endpoints
| Method | Endpoint | Change |
|---|---|---|
| `POST` | `/leave/requests` | Response includes avatar |
| `GET` | `/leave/requests` | Employee object includes avatar |
| `GET` | `/leave/requests/pending` | Employee object includes avatar |
| `GET` | `/leave/requests/:id` | Employee object includes avatar |
| `GET` | `/leave/requests/report` | Employee object includes avatar |

### Response Shape (employeeId object)
```json
"employeeId": {
  "_id": "...",
  "employeeCode": "EMP-0012",
  "firstName": "Harish",
  "lastName": "Soni",
  "avatarUrl": "https://cdn.example.com/avatars/emp-0012.jpg",
  "profilePicture": "https://cdn.example.com/profile/emp-0012.jpg"
}
```

### Frontend Action
```js
// Prioritize avatarUrl → profilePicture → fallback to initials
const avatar = employee.avatarUrl || employee.profilePicture || null;
```

---

## 2. 🎉 Holiday Management — Branch HR Scoping

### What Changed
The holiday list (`GET /leave/holidays`) now enforces branch-level visibility.

| Role | What They See |
|---|---|
| **HQ / ORG_ADMIN** | All holidays — no change |
| **Branch HR / Admin** | GLOBAL + COUNTRY + STATE holidays (shared) **+** Only their own branch's BRANCH-scope holidays |

### No Frontend Code Change Required
The filtering is done on the backend using the user's JWT token. The same API call returns the correct scoped result automatically.

---

## 3. 🌱 Holiday Seed — `?countryCode` Param Removed

### What Changed
`POST /leave/holidays/seed-default` no longer accepts a manual `?countryCode=XX` query parameter. The country code is **always derived from the Organization's registered locale**.

### Before
```bash
# ❌ This no longer works — countryCode is ignored
POST /leave/holidays/seed-default?countryCode=US
```

### After
```bash
# ✅ Seeds based on org's registered country (e.g. IN)
POST /leave/holidays/seed-default

# ✅ Still accepted — seeds state-level holidays for org's country
POST /leave/holidays/seed-default?stateCode=KA
```

### Error Case — No Country Configured on Org
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Organization has no country code configured. Please set a country code in your Organization settings first."
}
```

### Frontend Action
- Remove the country code selector from the **Seed Defaults** modal/dialog.
- The state code selector can remain.
- Display the API error message if a `400` is returned.

---

## 4. ⏱️ Attendance — Shift-Driven Late/Absent Thresholds

### What Changed
Attendance status thresholds (when someone is marked HALF_DAY or ABSENT based on arrival time) are no longer hardcoded. They are now configurable fields on each Shift.

### New Shift Fields
| Field | Default | Description |
|---|---|---|
| `absentThresholdMinutes` | `255` | Minutes after shift start → marked ABSENT |
| `lateArrivalHalfDayMinutes` | `90` | Minutes after shift start → marked HALF_DAY |

### Frontend Action *(Optional — for HR Settings)*
If you have a Shift Settings form, you can expose these two fields so HR can configure them per shift:

```bash
# Example PATCH to update thresholds for a shift
curl -X PATCH http://localhost:3000/api/v1/attendance/shifts/SHIFT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "absentThresholdMinutes": 180,
    "lateArrivalHalfDayMinutes": 60
  }'
```

---

## 5. 🕐 Attendance — `overtimeId` Linked After Checkout

### What Changed
After an employee punches `CHECK_OUT` or HR records a **Manual Entry**, the backend now automatically computes overtime for that day and links it back to the attendance record via `overtimeId`.

### Updated Attendance Record Response
```json
{
  "_id": "...",
  "employeeId": "...",
  "attendanceDate": "2026-07-29",
  "workedMinutes": 570,
  "status": "PRESENT",
  "overtimeId": "66f3a1b2c8e4d2f1a0b3c4d5"
}
```

### Frontend Action *(Optional)*
- If `overtimeId` is present on an attendance record → show an **"OT Computed"** badge on the attendance detail view.
- No separate API call needed to check if OT was computed.

---

## 📋 Summary Table

| # | Module | Change | Frontend Action Required? |
|---|---|---|---|
| 1 | Leave Requests | `avatarUrl` + `profilePicture` in employee populate | ✅ Yes — map new fields |
| 2 | Holiday List | Branch HR sees only own branch's BRANCH holidays | ❌ No — auto-filtered by token |
| 3 | Holiday Seed | `?countryCode` param removed | ✅ Yes — remove from UI |
| 4 | Attendance | Shift-driven absent/half-day thresholds | ⚙️ Optional — expose in Shift Settings |
| 5 | Attendance | `overtimeId` linked after checkout | ⚙️ Optional — show OT badge on detail view |
