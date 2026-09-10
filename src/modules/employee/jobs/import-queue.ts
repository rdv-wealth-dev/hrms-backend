import mongoose from "mongoose";
import { ImportSessionModel } from "../models/import-session.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

const WORKER_ID = `worker-${process.pid}`;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function pollForNextJob() {
  const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);

  // Claim one queued or stuck validation session job atomically
  const session = await ImportSessionModel.findOneAndUpdate(
    {
      status: "queued",
      $or: [
        { lockedAt: null },
        { lockedAt: { $lt: staleThreshold } }
      ]
    },
    {
      status: "validating",
      lockedAt: new Date(),
      lockedBy: WORKER_ID,
      $inc: { attempts: 1 }
    },
    { new: true, sort: { createdAt: 1 } }
  );

  if (!session) return false; // No jobs found — signal worker to stop

  console.log(`[ImportQueue] Worker ${WORKER_ID} claimed job for session: ${session.sessionId}`);

  try {
    const { EmployeeService } = require("../services/employee.service");
    const empService = new EmployeeService();

    const buffer = Buffer.from(session.fileBufferBase64 || "", "base64");

    const context: RequestContext = {
      tenantId: session.tenantId.toString(),
      userId: session.createdBy?.toString() || "",
      role: "SYSTEM",
      branchIds: [],
    };

    // run validation rules
    await empService.processValidation(context, session.sessionId, buffer, session.fileName);
    console.log(`[ImportQueue] Completed processing session: ${session.sessionId}`);

    // Unlock job on success
    await ImportSessionModel.updateOne(
      { sessionId: session.sessionId },
      { $set: { lockedAt: null, lockedBy: null } }
    );
  } catch (error: any) {
    console.error(`[ImportQueue] Worker error processing session ${session.sessionId}:`, error);

    const attempts = (session.attempts || 0) + 1;
    const finalStatus = attempts >= (session.maxAttempts || 3) ? "failed" : "queued";

    await ImportSessionModel.updateOne(
      { sessionId: session.sessionId },
      {
        $set: {
          status: finalStatus,
          lockedAt: null,
          lockedBy: null,
          lastError: error.message || String(error)
        }
      }
    );
  }

  return true; // Job was processed — caller should check for more
}

// ─── On-Demand Self-Draining Worker ─────────────────────────────────────────
// Worker only runs when there are actual jobs in the queue.
// It drains the queue completely, then stops automatically.
// Zero idle DB polls when no imports are happening.

let isWorkerRunning = false;

async function drainQueue() {
  if (isWorkerRunning) return; // Already running — prevent concurrent loops
  isWorkerRunning = true;
  console.log(`[ImportQueue] Worker started — draining queue...`);

  try {
    // Keep processing until the queue is empty
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const hadJob = await pollForNextJob();
      if (!hadJob) break; // Queue empty — stop

      // Small yield between jobs to avoid CPU spin on rapid successive imports
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch (err: any) {
    console.error("[ImportQueue] Uncaught worker drain error:", err);
  } finally {
    isWorkerRunning = false;
    console.log(`[ImportQueue] Worker idle — queue is empty.`);
  }
}

// startWorker is now a no-op kept for backward compat with main.ts.
// The worker is purely on-demand — triggered by addImportJob().
export function startWorker() {
  console.log(`[ImportQueue] On-demand worker registered (PID: ${process.pid}). No background polling.`);
}

export function stopWorker() {
  // No interval to clear — nothing to stop
  console.log(`[ImportQueue] stopWorker called (on-demand mode — no-op).`);
}

// Called when a new import job is queued.
// Kicks off the drain loop if not already running.
export async function addImportJob(jobData: {
  sessionId: string;
  context: RequestContext;
  fileBufferBase64: string;
  fileName: string;
}) {
  console.log(`[ImportQueue] Session ${jobData.sessionId} registered. Starting worker...`);
  // Fire-and-forget — drainQueue self-terminates when queue is empty
  drainQueue().catch(console.error);
}

