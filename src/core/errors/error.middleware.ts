import { Request, Response, NextFunction } from "express";
import { AppError } from "./app.error";
import { ErrorCode } from "./error-codes";
import { logger } from "../../config/logger";
import { buildErrorResponse } from "../database/base.schema";

export const globalErrorHandler = (
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction
): void => {
  logger.error({
    message:   err.message,
    stack:     err.stack,
    requestId: req.requestId,
    path:      req.path,
    method:    req.method,
    tenantId:  req.context?.tenantId ?? "unauthenticated",
  });

  // Known operational error — has stable errorCode already
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      buildErrorResponse(err.message, err.errors, err.errorCode)
    );
    return;
  }

  // MongoDB duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0];
    res.status(409).json(
      buildErrorResponse(`${field} already exists`, [], ErrorCode.RESOURCE_CONFLICT)
    );
    return;
  }

  // Mongoose / Zod validation error
  if (err.name === "ValidationError") {
    const errors = Object.values((err as any).errors).map((e: any) => e.message);
    res.status(400).json(
      buildErrorResponse("Validation failed", errors, ErrorCode.VALIDATION_FAILED)
    );
    return;
  }

  // jwt.verify throws this exact name for ANY malformed/invalid signature token
  if (err.name === "JsonWebTokenError") {
    res.status(401).json(
      buildErrorResponse("Invalid token", [], ErrorCode.AUTH_TOKEN_INVALID)
    );
    return;
  }

  // jwt.verify throws this exact name when exp has passed
  if (err.name === "TokenExpiredError") {
    res.status(401).json(
      buildErrorResponse("Token expired", [], ErrorCode.AUTH_TOKEN_EXPIRED)
    );
    return;
  }

  // Rate limiter (express-rate-limit) errors don't reach here normally —
  // it sends its own response — but kept as a safety net
  res.status(500).json(
    buildErrorResponse(
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
      [],
      ErrorCode.SYSTEM_INTERNAL_ERROR
    )
  );
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};