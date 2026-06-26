import express, {Application, Request, Response} from "express";
import { applySecurityMiddleware } from "./core/middlewares/security.middleware";
import { requestIdMiddleware } from "./core/middlewares/request-id.middleware";
import { globalErrorHandler } from "./core/errors/error.middleware";
import authRoutes from "./modules/auth/auth.routes"

const app: Application = express();

app.use(requestIdMiddleware)

// apply securityMiddleware
applySecurityMiddleware(app)


app.use("/api/v1/auth", authRoutes);

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