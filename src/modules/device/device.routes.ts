import { Router } from "express";
import { receiveRawBiometricWebhook, receiveBatchBiometricWebhook } from "./device-webhook.controller";
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

// ── Batch Webhook (Reconciliation / Day-dump) ─────────────────────────────────
// Accepts ALL punch logs for an entire day for ALL employees in one call.
// 100% idempotent — safe to call multiple times with same data (no duplicates).
// POST /api/v1/device/batch/:identifier
// POST /api/v1/device/batch/:identifier/:provider
router.post("/batch/:identifier/:provider", receiveBatchBiometricWebhook);
router.post("/batch/:identifier",           receiveBatchBiometricWebhook);

// ── Single Punch Webhook (Real-time live push — 1 punch per HTTP call) ────────
// Called by biometric device in real-time on each punch event.
// POST /api/v1/device/:identifier/:provider
// POST /api/v1/device/:identifier
router.post("/:identifier/:provider", receiveRawBiometricWebhook);
router.post("/:identifier",           receiveRawBiometricWebhook);

export default router;
