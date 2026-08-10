import { Request, Response } from "express";
import mongoose from "mongoose";
import { getRawLogModel } from "./biometric.models";
import { BranchModel } from "../branch/branch.model";
import { logger } from "../../config/logger.config";

// Biometric webhook endpoint supporting direct branchId injection
export async function receiveRawBiometricWebhook(req: Request, res: Response) {
  try {
    const identifier = (req.params.identifier || req.params.branchId || req.params.tenantId) as string;
    const explicitBranchId = req.params.branchId as string;
    const provider = req.params.provider as string;

    if (!identifier || !provider) {
      return res.status(400).json({ isSuccess: "N", outputMessage: "Missing branchId/tenantId or provider in webhook URL" });
    }

    if (!mongoose.Types.ObjectId.isValid(identifier)) {
      return res.status(400).json({ isSuccess: "N", outputMessage: "Invalid ID format" });
    }

    let tenantId = identifier;
    let branchId = explicitBranchId || identifier;

    // Check if the identifier is a Branch ID to automatically resolve the parent Tenant
    const branch = await BranchModel.findById(identifier).select("_id tenantId").lean();
    if (branch) {
      tenantId = branch.tenantId.toString();
      branchId = branch._id.toString();
    }

    const RawLogModel = getRawLogModel();

    await RawLogModel.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      branchId: new mongoose.Types.ObjectId(branchId),
      provider: provider.toLowerCase(),
      payload: req.body || {},
    });

    return res.status(200).json({ isSuccess: "Y", outputMessage: "Added Successfully" });
  } catch (err: any) {
    logger.error(`Failed to store raw biometric log: ${err.message}`);
    return res.status(500).json({ isSuccess: "N", outputMessage: "Internal server error" });
  }
}
