export type OnboardingPhase = "GRACE" | "NUDGE" | "RESTRICTED" | "COMPLETE";

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  branchIds: string[];
  requestId?: string;
  employeeId?: string;

  // Onboarding soft-gate — stamped by injectOnboardingStatus middleware.
  // Only present for EMPLOYEE-role users that have an employeeId linked.
  onboardingPhase?: OnboardingPhase;
  isProfileComplete?: boolean;
  profileCompletionPct?: number; // 0-100, for frontend banner
}
