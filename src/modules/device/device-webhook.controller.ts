import { Request, Response } from "express";
import mongoose from "mongoose";
import { getRawLogModel } from "./biometric.models";
import { BranchModel } from "../branch/branch.model";
import { OrganizationModel } from "../organization/organization.model";
import { logger } from "../../config/logger.config";

// Biometric webhook endpoint supporting direct branchId/tenantId resolution
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

    // 2. Validate Identifier
    if (!identifier) {
      return res.status(400).json({ isSuccess: false, outputMessage: "Missing branchId/tenantId in webhook URL" });
    }

    if (!mongoose.Types.ObjectId.isValid(identifier)) {
      return res.status(400).json({ isSuccess: false, outputMessage: "Invalid ID format" });
    }

    const id = new mongoose.Types.ObjectId(identifier);

    // 3. Resolve Branch / Tenant from DB
    const branch = await BranchModel.findOne({ _id: id, isDeleted: false }).select("_id tenantId").lean();
    if (branch) {
      tenantObjectId = branch.tenantId;
      branchObjectId = branch._id;
    } else {
      // Check if identifier is an Organization
      const org = await OrganizationModel.findOne({ _id: id, isDeleted: false }).select("_id").lean();
      if (org) {
        tenantObjectId = org._id;
      } else {
        return res.status(404).json({
          isSuccess: false,
          outputMessage: "No matching Branch or Organization found for the given identifier",
        });
      }
    }

    const RawLogModel = getRawLogModel();

    // 4. Extract Punch Info if available
    employeeID = String(
      payload.employeeID || payload.EmployeeCode || payload.userId || payload.EnrollNo || payload.badgenumber || payload.emp_code || ""
    ).trim();

    punchDate = String(
      payload.punchDate || payload.date || payload.RecordDate || payload.LogDate || ""
    ).trim();

    punchTime = String(
      payload.punchTime || payload.time || payload.RecordTime || payload.LogTime || ""
    ).trim();

    deviceSerialno = String(
      payload.deviceSerialno || payload.SerialNumber || payload.device_sn || payload.DeviceSerialNo || payload.deviceID || ""
    ).trim();

    // 5. Pre-save Duplicate Check (if employeeID, date & time are present)
    if (branchObjectId && employeeID && punchDate && punchTime) {
      const duplicate = await RawLogModel.findOne({
        branchId: branchObjectId,
        employeeID,
        punchDate,
        punchTime,
      }).select("_id").lean();

      if (duplicate) {
        // Return 200 to acknowledge device so it clears its internal send buffer
        return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });
      }
    }

    // 6. Ingest Raw Payload
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
    // 7. Handle Mongo Duplicate Key Error (Code 11000) gracefully
    if (err.code === 11000) {
      if (employeeID && punchDate && punchTime) {
        return res.status(200).json({ isSuccess: true, outputMessage: "Added Successfully" });
      }
      // If legacy unique index collided on null fields, drop old index and retry insert
      try {
        const RawLogModel = getRawLogModel();
        await RawLogModel.collection.dropIndex("uniq_branch_employee_punch").catch(() => {});
        await RawLogModel.syncIndexes().catch(() => {});
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






