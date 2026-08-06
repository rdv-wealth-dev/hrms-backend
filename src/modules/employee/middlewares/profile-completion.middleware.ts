import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { UserModel } from "../../user/user.model";
import { EmployeeModel } from "../models/employee.model";
import { AppError } from "../../../shared/errors/app.error";
import { ErrorCode } from "../../../shared/errors/error-codes";
import { OnboardingPhase } from "../../../shared/types/request-context.interface";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Roles that are never subject to the employee onboarding gate. */
const ADMIN_ROLES = new Set([
  "SUPER_ADMIN", "ORG_ADMIN", "HR_ADMIN", "LEADERSHIP",
  "MANAGER", "PRODUCT_MANAGER", "TEAM_LEADER", "BRANCH_ADMIN",
]);

/** Day boundaries for each phase (inclusive, relative to joiningDate). */
const GRACE_DAYS      = 3;  // Days 1–3: fully open
const NUDGE_DAYS      = 7;  // Days 4–7: open + persistent reminders
// Day 8+: RESTRICTED — non-essential features blocked until profile complete

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the number of calendar days elapsed since joiningDate (Day 1 = 0).
 * Uses the start-of-day in UTC to avoid timezone drift on the boundary.
 */
function daysSinceJoining(joiningDate: Date): number {
  const joinStart  = new Date(joiningDate);
  joinStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return Math.floor((todayStart.getTime() - joinStart.getTime()) / 86_400_000);
}

/**
 * Derives the onboarding phase from days elapsed and profile completion state.
 * COMPLETE is returned immediately whenever isProfileComplete is true,
 * regardless of how many days have passed.
 */
function resolvePhase(daysSince: number, isProfileComplete: boolean): OnboardingPhase {
  if (isProfileComplete) return "COMPLETE";
  if (daysSince < GRACE_DAYS)  return "GRACE";
  if (daysSince < NUDGE_DAYS)  return "NUDGE";
  return "RESTRICTED";
}

/**
 * Computes a 0–100 profile completion percentage from the stored flags.
 * Weights: personalDetails 25 | address 20 | emergencyContact 20 | bankDetails 20 | mandatoryDocs 15
 */
function computeCompletionPct(flags: {
  personalDetails:  boolean;
  address:          boolean;
  emergencyContact: boolean;
  bankDetails:      boolean;
  mandatoryDocs:    boolean;
}): number {
  const weights = { personalDetails: 25, address: 20, emergencyContact: 20, bankDetails: 20, mandatoryDocs: 15 };
  return Object.entries(weights).reduce(
    (acc, [key, w]) => acc + (flags[key as keyof typeof flags] ? w : 0),
    0,
  );
}

// ─── Middleware 1: injectOnboardingStatus ─────────────────────────────────────
//
// Runs on every authenticated route for EMPLOYEE-role users.
// Stamps req.context with onboardingPhase, isProfileComplete, profileCompletionPct.
// NEVER blocks the request — always calls next().
// Cost: 1 UserModel query (select employeeId) + 1 EmployeeModel query per request.
// Future optimisation: cache in Redis by userId with a 5-min TTL.

export const injectOnboardingStatus = async (
  req:  Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { role, userId, tenantId } = req.context;

    // Admin roles are never subject to the employee onboarding gate.
    if (ADMIN_ROLES.has(role)) {
      next();
      return;
    }

    const user = await UserModel.findOne({
      _id:      new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).select("employeeId");

    // No linked employee record — nothing to inject, pass through.
    if (!user?.employeeId) {
      next();
      return;
    }

    const employee = await EmployeeModel.findById(user.employeeId).select(
      "joiningDate isProfileComplete profileCompletion",
    );

    if (!employee) {
      next();
      return;
    }

    const days  = daysSinceJoining(employee.joiningDate);
    const phase = resolvePhase(days, employee.isProfileComplete);
    const pct   = computeCompletionPct(employee.profileCompletion ?? {
      personalDetails: false, address: false, emergencyContact: false,
      bankDetails: false, mandatoryDocs: false,
    });

    // Stamp context — downstream handlers and the restricted-feature guard read from here.
    req.context.onboardingPhase      = phase;
    req.context.isProfileComplete     = employee.isProfileComplete;
    req.context.profileCompletionPct  = pct;

    next();
  } catch (error) {
    // A non-fatal error here must NOT block the request.
    // Log and continue — onboarding status simply won't be stamped.
    console.error("[injectOnboardingStatus] Non-fatal error:", error);
    next();
  }
};

// ─── Middleware 2: requireProfileForRestrictedFeature ─────────────────────────
//
// Applied SURGICALLY to individual restricted routes (leave requests, payslips, etc.).
// Blocks only when: phase === RESTRICTED && !isProfileComplete.
// Assumes injectOnboardingStatus has already run upstream.
// If onboardingPhase is not stamped (e.g. admin, or no employeeId), it passes through.
//
// Usage:
//   router.post("/requests", requireProfileForRestrictedFeature("leave requests"), ...)
//   router.get("/payslips/me", requireProfileForRestrictedFeature("payslip downloads"), ...)

export const requireProfileForRestrictedFeature = (featureName: string) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // If status was not injected (admin / no employee), allow through.
    if (!req.context.onboardingPhase) {
      next();
      return;
    }

    if (
      req.context.onboardingPhase === "RESTRICTED" &&
      !req.context.isProfileComplete
    ) {
      next(new AppError(
        `Complete your profile to unlock ${featureName}. ` +
        `Your profile is ${req.context.profileCompletionPct ?? 0}% complete.`,
        403,
        ErrorCode.PROFILE_INCOMPLETE_HARD,
      ));
      return;
    }

    next();
  };

// ─── Legacy alias ─────────────────────────────────────────────────────────────
//
// Kept so that any external import of requireCompleteProfile still compiles.
// Points to the new surgical guard with a generic feature label.
// Routes that previously used router.use(requireCompleteProfile) should be
// migrated to injectOnboardingStatus + per-route requireProfileForRestrictedFeature.

/** @deprecated Use requireProfileForRestrictedFeature("feature name") instead. */
export const requireCompleteProfile = requireProfileForRestrictedFeature("this feature");