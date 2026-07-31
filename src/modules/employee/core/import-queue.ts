import mongoose from "mongoose";
import { ImportSessionModel } from "./import-session.model";
import { RequestContext } from "../../../core/interfaces/request-context.interface";

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

  if (!session) return; // No jobs found

  console.log(`[ImportQueue] Worker ${WORKER_ID} claimed job for session: ${session.sessionId}`);

  try {
    const { EmployeeService } = require("./employee.service");
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
}

// Start simple polling loop every 2 seconds
let pollInterval: NodeJS.Timeout | null = null;

export function startWorker() {
  if (pollInterval) return;
  console.log(`[ImportQueue] Starting database job worker loop...`);
  pollInterval = setInterval(() => {
    pollForNextJob().catch((err) => {
      console.error("[ImportQueue] Uncaught worker polling error:", err);
    });
  }, 2000);
}

export function stopWorker() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export async function addImportJob(jobData: {
  sessionId: string;
  context: RequestContext;
  fileBufferBase64: string;
  fileName: string;
}) {
  // In the DB-backed queue, the job is already written in 'queued' state.
  // We trigger an immediate worker poll check to speed up processing.
  console.log(`[ImportQueue] Session ${jobData.sessionId} registered. Triggering worker poll check.`);
  setTimeout(() => {
    pollForNextJob().catch(console.error);
  }, 0);
}
