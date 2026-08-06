import { Request, Response } from "express";
import mongoose from "mongoose";
import { getRawLogModel } from "./biometric.models";
import { logger } from "../../config/logger.config";

// Simple webhook endpoint with no authentication - inserts directly into raw biometric logs collection
export async function receiveRawBiometricWebhook(req: Request, res: Response) {
  try {
    const tenantId = req.params.tenantId as string;
    const provider = req.params.provider as string;

    if (!tenantId || !provider) {
      return res.status(400).json({ isSuccess: "N", outputMessage: "Missing tenantId or provider in webhook URL" });
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({ isSuccess: "N", outputMessage: "Invalid organization tenantId format" });
    }

    const RawLogModel = getRawLogModel();

    await RawLogModel.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      provider: provider.toLowerCase(),
      payload: req.body || {},
    });

    return res.status(200).json({ isSuccess: "Y", outputMessage: "Added Successfuly" });
  } catch (err: any) {
    logger.error(`Failed to store raw biometric log: ${err.message}`);
    return res.status(500).json({ isSuccess: "N", outputMessage: "Internal server error" });
  }
}
