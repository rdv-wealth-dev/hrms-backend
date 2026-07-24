import express, { Application, Request, Response } from "express";
import { applySecurityMiddleware } from "./core/middlewares/security.middleware";
import { requestIdMiddleware } from "./core/middlewares/request-id.middleware";
import { globalErrorHandler } from "./core/errors/error.middleware";
import { requireCompleteProfile } from "./modules/employee/profile-completion.middleware";
import { authenticate } from "./core/middlewares/auth.middleware";
import { createTenantRateLimiter } from "./core/middlewares/rate-limiter.middleware";
import authRoutes from "./modules/auth/auth.routes";
import organizationRoutes from "./modules/organization/organization.routes"
import branchRoutes from "./modules/branch/branch.routes"
import departmentRoutes from "./modules/department/department.routes";
import designationRoutes from "./modules/designation/designation.routes";
import employeeRoutes from "./modules/employee/employee.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import userRoutes from "./modules/user/user.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import profileRoutes from "./modules/profile/profile.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import eventRoutes from "./modules/event/event.routes";
import onboardingWizardRoutes from "./modules/employee/onboarding-wizard.routes";

const app: Application = express();

app.use(requestIdMiddleware)

// apply securityMiddleware
applySecurityMiddleware(app)

// Public — no auth, no tenant cap
app.use("/api/v1/auth", authRoutes);

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