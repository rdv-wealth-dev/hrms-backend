# HRMS Holiday Calendar API Documentation & cURL Examples

This document serves as a guide for frontend developers integrating the new Multi-Tenant, Multi-Country, and Multi-Branch Holiday Calendar system.

All requests require the `Authorization: Bearer <token>` header.

---

## 🔑 Base Configurations

*   **Base URL**: `http://localhost:3000/api/v1` (adjust to staging/production URLs)
*   **Authentication**: Add `Authorization: Bearer YOUR_ACCESS_TOKEN` to all headers.

---

## 🛠️ 1. Create a Holiday (`POST /leave/holidays`)

Create a holiday by specifying its scope (GLOBAL, COUNTRY, STATE, BRANCH). The validation rules dynamically adjust based on the selected scope.

### Case A: Branch-Scope Holiday
Use this for local branch-level overrides.
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
Requires a valid `countryCode` (e.g. "IN") and a `stateCode` (e.g. "KA" or full name like "Karnataka" which normalizes automatically).
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
Requires `countryCode` (e.g. "IN", "US") and applies to all branches in that country.
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
Applies to the entire tenant organization across all countries.
```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Global HRMS Founding Day",
    "date": "2026-06-01",
    "type": "NATIONAL",
    "scope": "GLOBAL",
    "isOptional": false,
    "description": "Global company foundation day off"
  }'
```

---

## 🔍 2. Resolve Holidays for a Branch (`GET /leave/holidays/resolve`)

Returns the fully resolved, deduplicated, and priority-merged (BRANCH > STATE > COUNTRY > GLOBAL) yearly holiday calendar for a specific branch.

*   `branchId` (required, string, 24-character hexadecimal ObjectId)
*   `year` (optional, number, defaults to the current year)

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
    },
    {
      "_id": "60d5ec49f1b2c52e40cd2a13",
      "name": "Karnataka Rajyotsava",
      "date": "2026-11-01T00:00:00.000Z",
      "scope": "STATE",
      "isOptional": false,
      "description": "State formation holiday for Karnataka branches",
      "branchId": null,
      "countryCode": "IN",
      "stateCode": "KA",
      "type": "REGIONAL"
    }
  ]
}
```

---

## 📅 3. Fetch Branch Monthly Calendar (`GET /branches/:branchId/calendar`)

Returns the monthly calendar showing dates mapped as `WORKING`, `WEEK_OFF` (with reasons), and `HOLIDAY` (resolved via engine). Also includes employee events (birthdays/anniversaries).

*   `year` (optional, defaults to current year)
*   `month` (optional, defaults to current month)

```bash
curl -X GET "http://localhost:3000/api/v1/branches/60d5ec49f1b2c52e40cd2a11/calendar?year=2026&month=11" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 👤 4. Fetch Personal Schedule (`GET /branches/me/schedule`)

Returns the monthly, rotation-aware personal attendance schedule for the calling employee.

*   `year` (optional, defaults to current year)
*   `month` (optional, defaults to current month)

```bash
curl -X GET "http://localhost:3000/api/v1/branches/me/schedule?year=2026&month=11" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## ✏️ 5. Update a Holiday (`PATCH /leave/holidays/:id`)

Updates specific properties of an existing holiday. This correctly triggers scope-aware conflict checks and cache invalidations.

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

## ❌ 6. Delete a Holiday (`DELETE /leave/holidays/:id`)

Soft-deletes a holiday and invalidates all associated caches immediately.

```bash
curl -X DELETE http://localhost:3000/api/v1/leave/holidays/60d5ec49f1b2c52e40cd2a12 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🌱 7. Seed Default Statutory Holidays (`POST /leave/holidays/seed-default`)

Allows existing tenants registered before this update to manually seed standard statutory national holidays (e.g. 15 August, Jan 26) matching their country. Safe to run multiple times (idempotent).

```bash
curl -X POST http://localhost:3000/api/v1/leave/holidays/seed-default \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

