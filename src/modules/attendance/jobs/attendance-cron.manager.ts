import cron, { ScheduledTask } from "node-cron";
import { OrganizationModel } from "../../organization/organization.model";
import { reconcileAttendanceForDate } from "./attendance-reconcile.service";
import { logger } from "../../../config/logger.config";

let activeCronTask: ScheduledTask | null = null;
let currentScheduleTime: string = "23:59";
let isEnabled: boolean = true;

/**
 * Converts "HH:mm" (e.g. "23:59", "21:30") to cron expression ("mm HH * * *")
 */
function timeToCronExpression(timeStr: string): string {
  const parts = timeStr.trim().split(":");
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time format: "${timeStr}". Must be HH:mm in 24-hour format.`);
  }

  return `${minute} ${hour} * * *`;
}

/**
 * Execute daily closeout & biometric reconciliation for all active organizations
 */
async function runDailyCloseoutForAllTenants() {
  logger.info("[AttendanceCron] Executing scheduled daily attendance closeout...");
  try {
    const orgs = await OrganizationModel.find({ isActive: true, isDeleted: false }).select("_id attendanceSettings");
    const today = new Date();

    for (const org of orgs) {
      // If auto-closeout specifically disabled for this org, skip
      if (org.attendanceSettings && org.attendanceSettings.autoCloseoutEnabled === false) {
        continue;
      }
      try {
        await reconcileAttendanceForDate(org._id.toString(), today);
      } catch (err: any) {
        logger.error(`[AttendanceCron] Failed for tenant=${org._id}: ${err.message}`);
      }
    }
    logger.info("[AttendanceCron] Completed daily attendance closeout for all active tenants.");
  } catch (err: any) {
    logger.error(`[AttendanceCron] Fatal error in cron execution: ${err.message}`);
  }
}

/**
 * Initialize the cron job on server start, picking up settings from database
 */
export async function initAttendanceCron(): Promise<void> {
  try {
    // Find the first org to initialize default schedule (or fallback to 23:59)
    const org = await OrganizationModel.findOne({ isActive: true, isDeleted: false })
      .select("attendanceSettings")
      .lean();

    if (org?.attendanceSettings) {
      if (org.attendanceSettings.autoCloseoutTime) {
        currentScheduleTime = org.attendanceSettings.autoCloseoutTime;
      }
      if (typeof org.attendanceSettings.autoCloseoutEnabled === "boolean") {
        isEnabled = org.attendanceSettings.autoCloseoutEnabled;
      }
    }

    if (!isEnabled) {
      logger.info("[AttendanceCron] Auto-closeout cron is currently disabled in settings.");
      return;
    }

    const cronExpr = timeToCronExpression(currentScheduleTime);
    activeCronTask = cron.schedule(cronExpr, runDailyCloseoutForAllTenants, {
      timezone: "Asia/Kolkata",
    });

    logger.info(`🕒 [AttendanceCron] Daily attendance cron initialized for ${currentScheduleTime} IST (expr: "${cronExpr}")`);
  } catch (err: any) {
    logger.error(`[AttendanceCron] Failed to initialize cron: ${err.message}`);
  }
}

/**
 * Reschedule the cron dynamically when HR updates the time via API
 */
export function rescheduleAttendanceCron(timeStr: string, enabled: boolean): { cronExpression: string; scheduleTime: string } {
  // Stop existing cron task if running
  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
  }

  isEnabled = enabled;
  currentScheduleTime = timeStr;

  if (!enabled) {
    logger.info("[AttendanceCron] Cron schedule disabled by admin.");
    return { cronExpression: "", scheduleTime: timeStr };
  }

  const cronExpr = timeToCronExpression(timeStr);
  activeCronTask = cron.schedule(cronExpr, runDailyCloseoutForAllTenants, {
    timezone: "Asia/Kolkata",
  });

  logger.info(`🔄 [AttendanceCron] Rescheduled attendance closeout cron to ${timeStr} IST (expr: "${cronExpr}")`);
  return { cronExpression: cronExpr, scheduleTime: timeStr };
}

/**
 * Get current running schedule status
 */
export function getAttendanceCronStatus() {
  return {
    autoCloseoutEnabled: isEnabled,
    autoCloseoutTime: currentScheduleTime,
    timezone: "Asia/Kolkata",
    isRunning: activeCronTask !== null,
  };
}
