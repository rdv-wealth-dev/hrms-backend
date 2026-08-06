import { Router } from "express";
import { receiveRawBiometricWebhook } from "./device-webhook.controller";

const router = Router();

// Biometric webhook endpoint - generic, supports dynamic tenantId and provider route params
router.post("/:tenantId/:provider", receiveRawBiometricWebhook);

export default router;
