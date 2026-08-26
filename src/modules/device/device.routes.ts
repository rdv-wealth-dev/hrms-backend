import { Router } from "express";
import { receiveRawBiometricWebhook } from "./device-webhook.controller";
import { BiometricLogController } from "./controllers/biometric-log.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";

const router = Router();
const logCtrl = new BiometricLogController();

// ── Authenticated Query Endpoints (Must be registered BEFORE /:identifier) ──

// GET /api/v1/device/logs/me — Employee self-service personal biometric punches
router.get(
  "/logs/me",
  authenticate,
  logCtrl.getMyLogs.bind(logCtrl)
);

// GET /api/v1/device/logs/summary — Admin live statistics (today's punches, modes breakdown)
router.get(
  "/logs/summary",
  authenticate,
  checkPermission("attendance.read"),
  logCtrl.getSummary.bind(logCtrl)
);

// GET /api/v1/device/logs — Admin & HR filterable logs stream
router.get(
  "/logs",
  authenticate,
  checkPermission("attendance.read"),
  logCtrl.listLogs.bind(logCtrl)
);

// ── Hardware Webhook Endpoints (Public — called by Biometric Hardware / Middleware) ──

// Route 1 — identifier + provider in URL (e.g. /api/v1/device/:identifier/:provider)
router.post("/:identifier/:provider", receiveRawBiometricWebhook);

// Route 2 — identifier only in URL (e.g. /api/v1/device/:identifier), provider from body/default
router.post("/:identifier", receiveRawBiometricWebhook);

export default router;
