import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";

// NOTE: express-rate-limit (IP-only, in-memory) has been replaced by
// the LRU-cache-based rate-limiter.middleware.ts which provides:
//   • Layer 1 — Login burst/rage-click guard  (loginRateLimiter)
//   • Layer 2 — Multi-tenant org + branch cap  (tenantRateLimiter)
//   • Layer 3 — Heavy action throttle          (heavyActionLimiter)
//
// auth.routes.ts   → loginRateLimiter
// app.ts           → tenantRateLimiter  (all /api/v1 routes except auth)
// payroll.routes   → heavyActionLimiter (generate + approve runs)

/**
 * Applies core security middleware: Helmet headers, CORS policy,
 * and body-size guards. Rate limiting is handled per-layer in
 * rate-limiter.middleware.ts.
 */
export function applySecurityMiddleware(app: Application): void {

  // Helmet — security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // CORS — allow all origins (tighten in production via env var)
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // Body parser — 100 kb cap prevents Large-Payload DoS attacks
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Trust first proxy hop (NGINX / Cloudflare) so req.ip is the
  // real client IP rather than the proxy's address.
  app.set("trust proxy", 1);
}