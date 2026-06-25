import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../errors/app.error";

// Validate request body
// Usage: router.post("/", validateBody(CreateEmployeeDto), controller)
export const validateBody = (schema: ZodSchema) => {
  return (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      // parse() validates AND transforms the data
      // It strips unknown fields — mass assignment protection
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );
        next(new AppError("Validation failed", 400, errors));
        return;
      }
      next(error);
    }
  };
};



// ─── Validate query params ────────────────────────────────────────────────────
// Usage: router.get("/", validateQuery(ListEmployeeQuery), controller)
export const validateQuery = (schema: ZodSchema) => {
  return (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );
        next(new AppError("Invalid query parameters", 400, errors));
        return;
      }
      next(error);
    }
  };
};

// ─── Validate route params ────────────────────────────────────────────────────
// Usage: router.get("/:id", validateParams(IdParamDto), controller)
export const validateParams = (schema: ZodSchema) => {
  return (
    req:  Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );
        next(new AppError("Invalid route parameters", 400, errors));
        return;
      }
      next(error);
    }
  };
};
