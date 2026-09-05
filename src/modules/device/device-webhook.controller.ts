import { Request, Response } from "express";
import mongoose from "mongoose";
import { getRawLogModel } from "./biometric.models";
import { BranchModel } from "../branch/branch.model";
import { OrganizationModel } from "../organization/organization.model";
import { logger } from "../../config/logger.config";

// ─── Shared: Resolve tenantId + branchId from an identifier 
async function resolveIdentifier(identifier: string): Promise<{
  tenantObjectId: mongoose.Types.ObjectId;
  branchObjectId?: mongoose.Types.ObjectId;
} | null> {
  if (!identifier || !mongoose.Types.ObjectId.isValid(identifier)) return null;
  const id = new mongoose.Types.ObjectId(identifier);

  const branch = await BranchModel.findOne({ _id: id, isDeleted: false })
    .select("_id tenantId")
    .lean();
  if (branch) {
    return { tenantObjectId: branch.tenantId, branchObjectId: branch._id };
  }

  const org = await OrganizationModel.findOne({ _id: id, isDeleted: false })
    .select("_id")
    .lean();
  if (org) {
    return { tenantObjectId: org._id };
  }

  return null;
}

// ─── Shared: Normalize a raw punch payload into clean fields 
function extractPunchFields(payload: any): {
  employeeID: string;
  punchDate: string;
  punchTime: string;
  deviceSerialno: string;
  modeofPunch: string;
  modeofAttn: string;
  deviceIp: string;
} {
  const employeeID = String(
    payload.employeeID || payload.EmployeeCode || payload.userId ||
    payload.EnrollNo || payload.badgenumber || payload.emp_code || payload.emp_id ||
    payload.EmployeeId || payload.UserId || ""
  ).trim();

  let rawDate = String(
    payload.punchDate || payload.date || payload.RecordDate || payload.LogDate ||
    payload.punch_date || ""
  ).trim();

  let rawTime = String(
    payload.punchTime || payload.time || payload.RecordTime || payload.LogTime ||
    payload.punch_time || ""
  ).trim();

  // If a combined date-time string was passed (e.g. "2026-09-05 09:30:15" or ISO string)
  const combined = String(
    payload.PunchDateTime || payload.datetime || payload.timestamp ||
    payload.PunchTime || payload.log_time || ""
  ).trim();

  if ((!rawDate || !rawTime) && combined) {
    const parts = combined.replace("T", " ").split(" ");
    if (parts.length >= 2) {
      if (!rawDate) rawDate = parts[0];
      if (!rawTime) rawTime = parts[1];
    }
  }

  // Also check if rawDate itself contains a space (combined timestamp in date field)
  if (rawDate && rawDate.includes(" ")) {
    const parts = rawDate.split(" ");
    rawDate = parts[0];
    if (!rawTime) rawTime = parts[1];
  }

  return {
    employeeID,
    punchDate: rawDate,
    punchTime: rawTime,
    deviceSerialno: String(
      payload.deviceSerialno || payload.SerialNumber || payload.device_sn ||
      payload.DeviceSerialNo || payload.deviceID || payload.device_id || ""
    ).trim(),
    modeofPunch: String(
      payload.modeofPunch || payload.punchType || payload.VerifyMode || payload.verify_mode || "Default"
    ).trim(),
    modeofAttn: String(
      payload.modeofAttn || payload.inOutMode || payload.in_out_mode || "Default"
    ).trim(),
    deviceIp: String(
      payload.ip || payload.deviceIp || payload.device_ip || ""
    ).trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY 1: Single Punch Webhook (Live push — 1 punch per HTTP call)
// Called by biometric device in real-time on each punch event.
// Responds in < 50ms so device never times out or drops the connection.
// URL: POST /api/v1/device/:identifier          (provider from body/default)
//      POST /api/v1/device/:identifier/:provider (provider from URL)
// ─────────────────────────────────────────────────────────────────────────────
export async function receiveRawBiometricWebhook(req: Request, res: Response) {
  let tenantObjectId: mongoose.Types.ObjectId | undefined;
  let branchObjectId: mongoose.Types.ObjectId | undefined;
  let provider = "realtime";
  const payload = req.body || {};
  let employeeID = "";
  let punchDate = "";
  let punchTime = "";
  let deviceSerialno = "";

  try {
    const identifier = typeof req.params.identifier === "string" ? req.params.identifier.trim() : "";

    // 1. Resolve Provider: URL param -> Request body -> Query param -> Default 'realtime'
    const providerParam = typeof req.params.provider === "string" ? req.params.provider.trim() : "";
    const bodyProvider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "";
    const queryProvider = typeof req.query?.provider === "string" ? (req.query.provider as string).trim() : "";
    provider = (providerParam || bodyProvider || queryProvider || "realtime").toLowerCase();

    // ── Auto-Detect Batch Payload ─────────────────────────────────────────────
    // If request body is an array or contains an array (e.g. /api/v1/device/:branchId/:provider or /api/v1/device/:branchId),
    // automatically delegate to the batch processor seamlessly without forcing a different URL.
    if (
      Array.isArray(req.body) ||
      (req.body && (Array.isArray(req.body.logs) || Array.isArray(req.body.data)))
    ) {
      return receiveBatchBiometricWebhook(req, res);
    }

    // 2. Validate Identifier
    if (!identifier) {
      return res.status(400).json({ isSuccess: false, outputMessage: "Missing branchId/tenantId in webhook URL" });
    }

    const resolved = await resolveIdentifier(identifier);
    if (!resolved) {
      return res.status(404).json({
        isSuccess: false,
        outputMessage: "No matching Branch or Organization found for the given identifier",
      });
    }

    tenantObjectId = resolved.tenantObjectId;
    branchObjectId = resolved.branchObjectId;

    const RawLogModel = getRawLogModel();
    const fields = extractPunchFields(payload);
    const normDate = normalizePunchDate(fields.punchDate);
    const normTime = normalizePunchTime(fields.punchTime);
    employeeID     = fields.employeeID;
    punchDate      = normDate || fields.punchDate;
    punchTime      = normTime || fields.punchTime;
    deviceSerialno = fields.deviceSerialno;

    // 3. Fast duplicate check before insert
    if (branchObjectId && employeeID && punchDate && punchTime) {
      const duplicate = await RawLogModel.findOne({
        branchId: branchObjectId, employeeID, punchDate, punchTime,
      }).select("_id").lean();

      if (duplicate) {
        return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });
      }
    }

    // 4. Ingest Raw Payload
    await RawLogModel.create({
      tenantId: tenantObjectId,
      ...(branchObjectId ? { branchId: branchObjectId } : {}),
      provider,
      ...(employeeID ? { employeeID } : {}),
      ...(punchDate ? { punchDate } : {}),
      ...(punchTime ? { punchTime } : {}),
      ...(deviceSerialno ? { deviceSerialno } : {}),
      payload,
    });

    return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });

  } catch (err: any) {
    // Handle Mongo Duplicate Key (race-condition between check and insert)
    if (err.code === 11000) {
      if (employeeID && punchDate && punchTime) {
        return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });
      }
      // Legacy null-field unique index collision — drop + rebuild + retry
      try {
        const RawLogModel = getRawLogModel();
        await RawLogModel.collection.dropIndex("uniq_branch_employee_punch").catch(() => { });
        await RawLogModel.syncIndexes().catch(() => { });
        if (tenantObjectId) {
          await RawLogModel.create({
            tenantId: tenantObjectId,
            ...(branchObjectId ? { branchId: branchObjectId } : {}),
            provider,
            payload,
          });
          return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });
        }
      } catch (retryErr: any) {
        logger.error(`Error retrying raw biometric insert: ${retryErr.message}`);
      }
    }

    logger.error(`Failed to store raw biometric log: ${err.message}`);
    return res.status(500).json({ isSuccess: false, outputMessage: "Internal server error" });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY 2 (RECOMMENDED): Batch Day-Log Webhook
//
// Accepts ALL punch logs for an entire day for all employees in one HTTP call.
// Designed for:
//   - Reconciliation cron jobs that pull buffered/offline logs from the device
//   - Middleware systems that batch-send daily dumps
//   - Any scenario where multiple in/out punches per employee per day arrive together
//
// Guarantees:
//   - 100% idempotent via MongoDB bulkWrite upsert on (branchId + employeeID + punchDate + punchTime)
//   - Safe to call multiple times with the same payload — never creates duplicates
//   - One employee can have N punch events in a day (check-in, break-out, break-in, check-out, etc.)
//
// URL: POST /api/v1/device/batch/:identifier
//      POST /api/v1/device/batch/:identifier/:provider
// ─────────────────────────────────────────────────────────────────────────────
export async function receiveBatchBiometricWebhook(req: Request, res: Response) {
  try {
    const identifier = typeof req.params.identifier === "string" ? req.params.identifier.trim() : "";
    const providerParam = typeof req.params.provider === "string" ? req.params.provider.trim() : "";
    const bodyProvider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "";
    const queryProvider = typeof req.query?.provider === "string" ? (req.query.provider as string).trim() : "";
    const provider = (providerParam || bodyProvider || queryProvider || "batch").toLowerCase();

    // ── 1. Validate Identifier ───────────────────────────────────────────────
    if (!identifier) {
      return res.status(400).json({
        isSuccess: false,
        outputMessage: "Missing branchId/tenantId in webhook URL",
      });
    }

    const resolved = await resolveIdentifier(identifier);
    if (!resolved) {
      return res.status(404).json({
        isSuccess: false,
        outputMessage: "No matching Branch or Organization found for the given identifier",
      });
    }

    const { tenantObjectId, branchObjectId } = resolved;

    // ── 2. Validate Payload is an Array ─────────────────────────────────────
    //
    // Accepted body shapes:
    //   Shape A (root array):   [ { employeeID, punchDate, punchTime, ... }, ... ]
    //   Shape B (wrapped):      { logs: [ ... ], provider: "cron" }
    //   Shape C (date dump):    { date: "2026-09-05", logs: [ ... ] }
    //
    const body = req.body || {};
    const rawLogs: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body.logs)
        ? body.logs
        : Array.isArray(body.data)
          ? body.data
          : [];

    if (rawLogs.length === 0) {
      return res.status(400).json({
        isSuccess: false,
        outputMessage: "No punch logs found in request. Send an array under root, 'logs', or 'data' key.",
      });
    }

    if (rawLogs.length > 5000) {
      return res.status(413).json({
        isSuccess: false,
        outputMessage: "Batch too large. Maximum 5000 punch logs per request. Split into multiple batches.",
      });
    }

    // ── 3. Parse and Validate Each Log Entry ────────────────────────────────
    const RawLogModel = getRawLogModel();
    const now = new Date();

    const bulkOps: any[] = [];
    const skipped: { index: number; reason: string; raw: any }[] = [];
    const seen = new Set<string>(); // dedup within same batch

    for (let i = 0; i < rawLogs.length; i++) {
      const entry = rawLogs[i];
      if (!entry || typeof entry !== "object") {
        skipped.push({ index: i, reason: "Entry is not an object", raw: entry });
        continue;
      }

      const fields = extractPunchFields(entry);

      // Required fields validation
      if (!fields.employeeID) {
        skipped.push({ index: i, reason: "Missing employeeID (or EmployeeCode / userId / EnrollNo)", raw: entry });
        continue;
      }
      if (!fields.punchDate) {
        skipped.push({ index: i, reason: "Missing punchDate (or date / RecordDate / LogDate)", raw: entry });
        continue;
      }
      if (!fields.punchTime) {
        skipped.push({ index: i, reason: "Missing punchTime (or time / RecordTime / LogTime)", raw: entry });
        continue;
      }

      // punchDate format validation (YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY)
      const normalizedDate = normalizePunchDate(fields.punchDate);
      if (!normalizedDate) {
        skipped.push({ index: i, reason: `Invalid punchDate format: "${fields.punchDate}". Use YYYY-MM-DD`, raw: entry });
        continue;
      }

      // punchTime format validation (HH:MM or HH:MM:SS)
      const normalizedTime = normalizePunchTime(fields.punchTime);
      if (!normalizedTime) {
        skipped.push({ index: i, reason: `Invalid punchTime format: "${fields.punchTime}". Use HH:MM or HH:MM:SS`, raw: entry });
        continue;
      }

      // Dedup within the same batch (same punch from same employee at same time)
      const dedupeKey = `${branchObjectId?.toString() ?? tenantObjectId.toString()}|${fields.employeeID}|${normalizedDate}|${normalizedTime}`;
      if (seen.has(dedupeKey)) {
        skipped.push({ index: i, reason: "Duplicate entry within this batch", raw: entry });
        continue;
      }
      seen.add(dedupeKey);

      // Build the upsert operation
      // The unique compound index on (branchId, employeeID, punchDate, punchTime)
      // guarantees idempotency across multiple batch runs.
      bulkOps.push({
        updateOne: {
          filter: {
            ...(branchObjectId ? { branchId: branchObjectId } : { tenantId: tenantObjectId }),
            employeeID: fields.employeeID,
            punchDate: normalizedDate,
            punchTime: normalizedTime,
          },
          update: {
            $setOnInsert: {
              tenantId: tenantObjectId,
              ...(branchObjectId ? { branchId: branchObjectId } : {}),
              provider,
              employeeID: fields.employeeID,
              punchDate: normalizedDate,
              punchTime: normalizedTime,
              ...(fields.deviceSerialno ? { deviceSerialno: fields.deviceSerialno } : {}),
              payload: {
                ...entry,
                // Normalize these into the stored payload for consistency
                employeeID: fields.employeeID,
                punchDate: normalizedDate,
                punchTime: normalizedTime,
                modeofPunch: fields.modeofPunch,
                modeofAttn: fields.modeofAttn,
                deviceIp: fields.deviceIp,
                deviceSerialno: fields.deviceSerialno,
              },
              receivedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    // ── 4. Execute bulkWrite ─────────────────────────────────────────────────
    let insertedCount = 0;
    let duplicateCount = 0;

    if (bulkOps.length > 0) {
      const result = await RawLogModel.bulkWrite(bulkOps, { ordered: false });
      insertedCount = result.upsertedCount ?? 0;
      duplicateCount = result.matchedCount ?? 0; // matched = already existed (no insert)
    }

    // ── 5. Build Response ────────────────────────────────────────────────────
    const totalReceived = rawLogs.length;
    const totalSkipped = skipped.length;
    const totalProcessed = bulkOps.length;

    logger.info(
      `[BatchWebhook] branch=${branchObjectId?.toString()} | ` +
      `received=${totalReceived} | inserted=${insertedCount} | ` +
      `duplicates=${duplicateCount} | skipped=${totalSkipped}`
    );

    return res.status(200).json({
      isSuccess: true,
      outputMessage: "Batch processed successfully",
      summary: {
        totalReceived,
        totalProcessed,
        inserted: insertedCount,
        duplicates: duplicateCount,
        skipped: totalSkipped,
      },
      ...(skipped.length > 0 ? { skippedDetails: skipped } : {}),
    });

  } catch (err: any) {
    logger.error(`[BatchWebhook] Fatal error: ${err.message}`);
    return res.status(500).json({
      isSuccess: false,
      outputMessage: "Internal server error while processing batch",
    });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS: Date & Time normalizers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize punchDate to YYYY-MM-DD.
 * Accepts: "2026-09-05", "05/09/2026", "05-09-2026"
 * Returns null if the format is unrecognizable.
 */
function normalizePunchDate(raw: string): string | null {
  const s = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // MM/DD/YYYY (US format)
  const mdy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) {
    const month = parseInt(mdy[1]);
    const day = parseInt(mdy[2]);
    // If month > 12, it's actually DD/MM/YYYY
    if (month > 12) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
    return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
  }

  return null;
}

/**
 * Normalize punchTime to HH:MM:SS (or HH:MM if seconds not provided).
 * Accepts: "09:30:25" -> "09:30:25", "9:5:2" -> "09:05:02", "09:30" -> "09:30"
 * Returns null if the format is unrecognizable.
 */
function normalizePunchTime(raw: string): string | null {
  const s = raw.trim();

  // HH:MM:SS or HH:MM
  const match = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hh = String(parseInt(match[1])).padStart(2, "0");
  const mm = String(parseInt(match[2])).padStart(2, "0");
  const ss = match[3] !== undefined ? String(parseInt(match[3])).padStart(2, "0") : null;

  if (parseInt(hh) > 23 || parseInt(mm) > 59) return null;
  if (ss !== null && parseInt(ss) > 59) return null;

  return ss !== null ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

