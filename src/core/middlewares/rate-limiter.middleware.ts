import { Request, Response, NextFunction } from "express";
import { LRUCache } from "lru-cache";
import { logger } from "../../config/logger";

// SHARED LRU CACHE ENGINE
//
// Single cache instance shared across all 3 layers.
// max: 100,000 — handles high-volume multi-tenant traffic without Redis.
// ttlAutopurge: true  — background sweep frees RAM for expired windows.

interface RateRecord {
  count:     number;
  resetTime: number; // epoch ms when this window expires
}

interface LimitResult {
  allowed:    boolean;
  remaining:  number;
  resetSecs:  number;
}

const hrmsLimiterCache = new LRUCache<string, RateRecord>({
  max:          100_000,
  ttl:          60 * 1_000, // 1-min default (overridden per key)
  ttlAutopurge: true,
});

/**
 * Core evaluation function.
 * Increments the counter for a key and returns whether the request is allowed,
 * how many hits remain, and how many seconds until the window resets.
 *
 * This is the single function to swap out when migrating to Redis.
 * Replace with: INCR + EXPIRE + TTL pipeline calls.
 */
function evaluateLimit(
  key:      string,
  windowMs: number,
  maxLimit: number
): LimitResult {
  const now    = Date.now();
  let record   = hrmsLimiterCache.get(key);

  if (!record) {
    record = { count: 1, resetTime: now + windowMs };
    hrmsLimiterCache.set(key, record, { ttl: windowMs });
    return {
      allowed:   true,
      remaining: maxLimit - 1,
      resetSecs: Math.ceil(windowMs / 1_000),
    };
  }

  record.count += 1;
  const remainingMs  = Math.max(record.resetTime - now, 1_000);
  hrmsLimiterCache.set(key, record, { ttl: remainingMs });

  return {
    allowed:   record.count <= maxLimit,
    remaining: Math.max(maxLimit - record.count, 0),
    resetSecs: Math.ceil(remainingMs / 1_000),
  };
}

// SUBSCRIPTION TIER → ORG RATE LIMIT MAP
//
// Mapped to your Organization.subscription.plan enum:
//   "free" | "starter" | "growth" | "enterprise"
//
// Math: average active users × avg req/min × burst buffer
//   free:       10 employees  × 15 req/min × 2.0× buffer  =   300 req/min
//   starter:    50 employees  × 15 req/min × 2.0× buffer  = 1,500 req/min
//   growth:    200 employees  × 15 req/min × 2.0× buffer  = 6,000 req/min
//   enterprise: 2000 employees × 15 req/min × 1.5× buffer = 45,000 req/min

const ORG_TIER_LIMITS: Record<string, number> = {
  free:       300,
  starter:    1_500,
  growth:     6_000,
  enterprise: 45_000,
};

// LAYER 1 — LOGIN BURST GUARD (Tap-Tap / Rage-Click Blocker)
//
// Keyed on IP + lowercase email — each account tracked independently.
// Different users on the same shared office IP are NOT affected by each other.
//
// Rules:
//   • Max 3 rapid attempts in 10 seconds
//   • On breach → 15-minute IP + email lockout
//   • Applied only on POST /api/v1/auth/login

export async function loginRateLimiter(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const ip    = req.ip ?? "unknown";
  const email = req.body?.email
    ? String(req.body.email).toLowerCase().trim()
    : undefined;

  // If no email, let the DTO validator downstream produce the proper error
  if (!email) { next(); return; }

  const burstKey = `rl:burst:${ip}:${email}`;
  const blockKey = `rl:blocked:${ip}:${email}`;
  const now      = Date.now();

  // Check active lockout
  const blocked = hrmsLimiterCache.get(blockKey);
  if (blocked) {
    const remainingSecs = Math.ceil((blocked.resetTime - now) / 1_000);
    res.set("Retry-After", String(remainingSecs));
    res.status(429).json({
      succeeded: false,
      message:   `Too many login attempts. Account locked. Retry in ${Math.ceil(remainingSecs / 60)} minute(s).`,
      errors:    [],
      data:      null,
    });
    return;
  }

  // Track burst taps: 3 per 10 s
  const burst = evaluateLimit(burstKey, 10_000, 3);

  if (!burst.allowed) {
    const banTtl = 15 * 60 * 1_000;
    hrmsLimiterCache.set(blockKey, { count: 1, resetTime: now + banTtl }, { ttl: banTtl });
    res.set("Retry-After", "900");
    res.status(429).json({
      succeeded: false,
      message:   "Rapid login attempts detected. Account login locked for 15 minutes.",
      errors:    [],
      data:      null,
    });
    return;
  }

  next();
}

// LAYER 2 — HIERARCHICAL 3-TIER RATE LIMITER
//
// Every authenticated request passes through 3 cascading checks in RAM:
//
//   Tier 1 — Per User    (HARD block)  — Fair-use guardrail
//     Key: rl:usr:{tenantId}:{userId}
//     Stops: runaway scripts, compromised accounts, rage-clicking HR managers
//     Default: 60 req / 1 min per user
//
//   Tier 2 — Per Branch  (HARD block)  — Noisy-neighbour guardrail
//     Key: rl:br:{tenantId}:{branchId}
//     Stops: one branch's stampede (8:59 AM clock-in) from hurting other branches
//     Math: ~20 active users × 15 req/min × 2× burst buffer = 600 req/min
//     Default: 600 req / 1 min per branch
//
//   Tier 3 — Per Org     (SOFT alert)  — Subscription capacity guardrail
//     Key: rl:org:{tenantId}
//     Tied to Organization.subscription.plan (free/starter/growth/enterprise)
//     On breach: logs a WARN (sales upsell signal) — does NOT block operations
//     Default: plan-based (300 → 1500 → 6000 → 45000)
//
// Pro-tip implemented: Retry-After + X-RateLimit-* headers on every response
// Pro-tip implemented: Org limit is SOFT — never crash business operations

interface TenantLimiterOptions {
  // Per-user standard window
  userWindowMs?: number;  // default: 60,000 (1 min)
  userMaxHits?:  number;  // default: 60

  // Per-branch window
  branchWindowMs?: number; // default: 60,000 (1 min)
  branchMaxHits?:  number; // default: 600

  // Org soft-limit window (always 1 min, limit is tier-derived)
  orgWindowMs?: number;    // default: 60,000
}

export function createTenantRateLimiter(options: TenantLimiterOptions = {}) {
  const userWindowMs   = options.userWindowMs   ?? 60_000;
  const userMaxHits    = options.userMaxHits     ?? 60;
  const branchWindowMs = options.branchWindowMs  ?? 60_000;
  const branchMaxHits  = options.branchMaxHits   ?? 600;
  const orgWindowMs    = options.orgWindowMs     ?? 60_000;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = req.context;

    if (!ctx?.tenantId || !ctx?.userId) {
      res.status(401).json({
        succeeded: false,
        message:   "Unauthorized: Missing tenant context.",
        errors:    [],
        data:      null,
      });
      return;
    }

    // ── Tier 1: Per-User (HARD)
    const userKey   = `rl:usr:${ctx.tenantId}:${ctx.userId}`;
    const userCheck = evaluateLimit(userKey, userWindowMs, userMaxHits);

    if (!userCheck.allowed) {
      res.set("Retry-After",           String(userCheck.resetSecs));
      res.set("X-RateLimit-Limit",     String(userMaxHits));
      res.set("X-RateLimit-Remaining", "0");
      res.status(429).json({
        succeeded: false,
        message:   `You are making requests too fast. Please slow down for ${userCheck.resetSecs}s.`,
        errors:    [],
        data:      null,
      });
      return;
    }

    // ── Tier 2: Per-Branch (HARD) 
    // Use the primary branch from the JWT branchIds array.
    // If a user belongs to multiple branches, the first is the "home" branch.
    const branchId  = ctx.branchIds?.[0] ?? "none";
    const branchKey = `rl:br:${ctx.tenantId}:${branchId}`;
    const branchCheck = evaluateLimit(branchKey, branchWindowMs, branchMaxHits);

    if (!branchCheck.allowed) {
      res.set("Retry-After", String(branchCheck.resetSecs));
      res.status(429).json({
        succeeded: false,
        message:   `High traffic at your branch location. Retry in ${branchCheck.resetSecs}s.`,
        errors:    [],
        data:      null,
      });
      return;
    }

    // ── Tier 3: Per-Org (SOFT — logs alert, does NOT block) 
    // Limit is derived from Organization.subscription.plan stored in JWT context.
    // If plan is not in context (legacy tokens), defaults to "free" limits.
    // On breach: log a WARN so your sales team gets an upsell signal.
    //            Never return 429 — do not crash live business operations.
    const plan      = (ctx as any).plan ?? "free"; // set via JWT when billing is built
    const orgMax    = ORG_TIER_LIMITS[plan] ?? ORG_TIER_LIMITS.free;
    const orgKey    = `rl:org:${ctx.tenantId}`;
    const orgCheck  = evaluateLimit(orgKey, orgWindowMs, orgMax);

    if (!orgCheck.allowed) {
      // SOFT limit — log upsell signal, let request through
      logger.warn(
        `[RATE-LIMIT] Org soft-limit breached | tenantId=${ctx.tenantId} | plan=${plan} | cap=${orgMax}/min | count=${orgMax - orgCheck.remaining + orgMax} | userId=${ctx.userId}`
      );
      // Optionally: emit to analytics / Slack webhook here
    }

    // ── Attach standard rate-limit headers to every successful response 
    // Clients (mobile apps, frontend) can read these to disable buttons proactively
    res.set("X-RateLimit-Limit",     String(userMaxHits));
    res.set("X-RateLimit-Remaining", String(userCheck.remaining));
    res.set("X-RateLimit-Reset",     String(Math.ceil(Date.now() / 1_000) + userCheck.resetSecs));

    next();
  };
}

// LAYER 3 — HEAVY ACTION LIMITER (Payroll Generate / Exports / Approvals)
//
// Protects CPU/DB-intensive endpoints at the per-user level.
// Key includes a normalised route path so each endpoint has its own budget.
//
// Key: rl:heavy:{userId}:{normalisedRoute}
//
// Usage in routes:
//   router.post("/runs/:id/generate",
//     checkPermission("payroll.run"),
//     heavyActionLimiter(2, 300),   // 2 calls per 5 minutes per user
//     ctrl.generatePayslips
//   )

export function heavyActionLimiter(maxCalls: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1_000;

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.context?.userId;

    if (!userId) {
      res.status(401).json({
        succeeded: false,
        message:   "Unauthorized.",
        errors:    [],
        data:      null,
      });
      return;
    }

    // Normalise dynamic MongoDB ObjectId segments so all runs share one counter
    // e.g. /payroll/runs/abc123/generate → /payroll/runs/:id/generate
    const route = (req.baseUrl + req.path).replace(/\/[a-f0-9]{24,}\//gi, "/:id/");
    const key   = `rl:heavy:${userId}:${route}`;

    const result = evaluateLimit(key, windowMs, maxCalls);

    if (!result.allowed) {
      res.set("Retry-After", String(result.resetSecs));
      res.status(429).json({
        succeeded: false,
        message:   `This action is limited to ${maxCalls}× per ${Math.ceil(windowSeconds / 60)} min. Retry in ${result.resetSecs}s.`,
        errors:    [],
        data:      null,
      });
      return;
    }

    next();
  };
}
