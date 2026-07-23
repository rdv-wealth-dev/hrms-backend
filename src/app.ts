import express, {Application, Request, Response} from "express";
import { applySecurityMiddleware } from "./core/middlewares/security.middleware";
import { requestIdMiddleware } from "./core/middlewares/request-id.middleware";
import { globalErrorHandler } from "./core/errors/error.middleware";
import { requireCompleteProfile } from "./modules/employee/profile-completion.middleware";
import authRoutes from "./modules/auth/auth.routes";
import organizationRoutes from "./modules/organization/organization.routes"
import branchRoutes from  "./modules/branch/branch.routes"
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

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organizations", organizationRoutes);
app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/departments",  departmentRoutes);
app.use("/api/v1/designations", designationRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/onboarding", onboardingWizardRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/leave", leaveRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/payroll", payrollRoutes);
app.use("/api/v1/events", eventRoutes);

app.get("/health",(_req: Request, res: Response) => {
  res.status(200).json({
    succeeded: true,
    message : "HRMS Api Running",
    data: {
      status: "ok",
      timeStamp: new Date().toISOString(),
    }
  })
});


app.use(globalErrorHandler)

export default app;