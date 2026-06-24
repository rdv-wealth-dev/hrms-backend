import { Request, Response, NextFunction } from "express";
import { AppError } from "./app.error";
import { logger } from "../../config/logger";
import { buildErrorResponse } from "../database/base.schema";

// Global Error Handler

export const globalErrorHandler = (
    err : Error,
    req : Request,
    res : Response,
    _next : NextFunction
): void =>{
    logger.error({
        message : err.message,
        stack : err.stack,
        requestId : req.requestId,
        path : req.path,
        method : req.method,
        tenantId:  req.context?.tenantId ?? "unauthenticated",
    });
     if (err instanceof AppError) {
    res.status(err.statusCode).json(
      buildErrorResponse(err.message, err.errors)
    );
    return;
  }

  // MongoDB duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0];
    res.status(409).json(
      buildErrorResponse(`${field} already exists`)
    );
    return;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values((err as any).errors).map(
      (e: any) => e.message
    );
    res.status(400).json(
      buildErrorResponse("Validation failed", errors)
    );
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json(buildErrorResponse("Invalid token"));
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json(buildErrorResponse("Token expired"));
    return;
  }

  // Unknown — never leak details in production
  res.status(500).json(
    buildErrorResponse(
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message
    )
  );
};

// Async handler wrapper
// Wraps async controllers — no try/catch needed in any controller
// Usage: router.get("/", asyncHandler(controller.list))
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}