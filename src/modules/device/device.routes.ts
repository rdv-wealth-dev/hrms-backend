import { Router } from "express";
import { receiveRawBiometricWebhook } from "./device-webhook.controller";

const router = Router();

// Biometric webhook endpoints supporting both branchId and tenantId routing
router.post("/:identifier/:provider", receiveRawBiometricWebhook);
router.post("/:tenantId/:branchId/:provider", receiveRawBiometricWebhook);

export default router;
