import { Router } from "express";
import { receiveRawBiometricWebhook } from "./device-webhook.controller";

const router = Router();

// Route 1 — identifier + provider in URL (e.g. /api/v1/device/:identifier/:provider)
router.post("/:identifier/:provider", receiveRawBiometricWebhook);

// Route 2 — identifier only in URL (e.g. /api/v1/device/:identifier), provider from body/default
router.post("/:identifier", receiveRawBiometricWebhook);

export default router;

