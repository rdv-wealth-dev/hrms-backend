import express, { Application, Request, Response } from "express";
import compression from "compression";
import { applySecurityMiddleware } from "./shared/middlewares/security.middleware";
import { requestIdMiddleware } from "./shared/middlewares/request-id.middleware";
import { globalErrorHandler } from "./shared/errors/error.middleware";
import { requireCompleteProfile } from "./modules/employee/middlewares/profile-completion.middleware";
import { authenticate } from "./shared/middlewares/auth.middleware";
import { createTenantRateLimiter } from "./shared/middlewares/rate-limiter.middleware";
import authRoutes from "./modules/auth";
import organizationRoutes from "./modules/organization"
import branchRoutes from "./modules/branch"
import departmentRoutes from "./modules/department";
import designationRoutes from "./modules/designation";
import employeeRoutes from "./modules/employee/employee.routes";
import attendanceRoutes from "./modules/attendance";
import userRoutes from "./modules/user";
import leaveRoutes from "./modules/leave";
import profileRoutes from "./modules/profile";
import payrollRoutes from "./modules/payroll";
import eventRoutes from "./modules/event";
import onboardingWizardRoutes from "./modules/employee/onboarding-wizard.routes";
import auditRoutes from "./modules/audit";
import employeeDocumentRoutes from "./modules/employee-document/employee-document.routes";
import deviceRoutes from "./modules/device/device.routes";

const app: Application = express();

app.use(compression());
app.use(requestIdMiddleware)

// apply securityMiddleware
applySecurityMiddleware(app)

// Public — no auth, no tenant cap
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/device", deviceRoutes);

//Layer 2: Tenant Rate Limiter
// authenticate populates req.context, then tenantRateLimiter applies
// org-wide (5 000 req/min) and branch-wide (1 000 req/min) caps.
const tenantLimiter = createTenantRateLimiter(); // factory called once at startup

app.use("/api/v1/organizations", authenticate, tenantLimiter, organizationRoutes);
app.use("/api/v1/branches", authenticate, tenantLimiter, branchRoutes);
app.use("/api/v1/departments", authenticate, tenantLimiter, departmentRoutes);
app.use("/api/v1/designations", authenticate, tenantLimiter, designationRoutes);
app.use("/api/v1/employees", authenticate, tenantLimiter, employeeRoutes);
app.use("/api/v1/onboarding", authenticate, tenantLimiter, onboardingWizardRoutes);
app.use("/api/v1/attendance", authenticate, tenantLimiter, attendanceRoutes);
app.use("/api/v1/users", authenticate, tenantLimiter, userRoutes);
app.use("/api/v1/leave", authenticate, tenantLimiter, leaveRoutes);
app.use("/api/v1/profile", authenticate, tenantLimiter, profileRoutes);
app.use("/api/v1/payroll", authenticate, tenantLimiter, payrollRoutes);
app.use("/api/v1/events", authenticate, tenantLimiter, eventRoutes);
app.use("/api/v1/audit", authenticate, tenantLimiter, auditRoutes);
app.use("/api/v1/employee-documents", authenticate, tenantLimiter, employeeDocumentRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    succeeded: true,
    message: "HRMS Api Running",
    data: {
      status: "ok",
      timeStamp: new Date().toISOString(),
    }
  })
});


app.use(globalErrorHandler)

export default app;