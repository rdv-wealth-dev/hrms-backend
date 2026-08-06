import { Request, Response } from "express";
import { getRawLogModel } from "./biometric.models";
import { logger } from "../../config/logger.config";

// Simple webhook endpoint with no authentication - inserts directly into raw_logs
export async function receiveRawTimeWatchWebhook(req: Request, res: Response) {
  try {
    const RawLogModel = getRawLogModel();

    await RawLogModel.create({
      payload: req.body || {},
    });

    return res.status(200).json({ isSuccess: "Y", outputMessage: "Added Successfuly" });
  } catch (err: any) {
    logger.error(`Failed to store raw timewatch log: ${err.message}`);
    return res.status(500).json({ isSuccess: "N", outputMessage: "Internal server error" });
  }
}
