import { Router } from "express";
import { receiveRawTimeWatchWebhook } from "./device-webhook.controller";

const router = Router();

// Biometric webhook endpoint - unauthenticated raw timewatch logger
router.post("/timewatch", receiveRawTimeWatchWebhook);

export default router;
