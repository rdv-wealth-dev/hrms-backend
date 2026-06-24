import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";

// Auth rate limiter — exported separately
// Applied directly on auth routes: router.post("/login", authLimiter, controller)
export const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,   // 15 minutes
  max:             10,               // max 10 login attempts
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    succeeded: false,
    message:   "Too many auth attempts. Please try again later.",
    errors:    [],
    data:      null,
  },
});

// Apply all security middleware to app
export function applySecurityMiddleware(app: Application): void {

  // Helmet — security headers
  app.use(helmet());

  // CORS — allowlist only
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = env.allowedOrigins

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials:    true,
      methods:        ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      exposedHeaders: ["x-request-id"],
    })
  );

  // Body parser — size limits prevent LPDOS attacks
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // Global rate limiter — 100 req / 15 min per IP
  app.use(
    rateLimit({
      windowMs:        15 * 60 * 1000,
      max:             100,
      standardHeaders: true,
      legacyHeaders:   false,
      message: {
        succeeded: false,
        message:   "Too many requests. Please try again later.",
        errors:    [],
        data:      null,
      },
    })
  );
}