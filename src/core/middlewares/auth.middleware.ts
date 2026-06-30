import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { NoTokenError, TokenMalformedError, } from "../errors/app.error";

declare global {
  namespace Express {
    interface Request {
      context:   import("../interfaces/request-context.interface").RequestContext;
      requestId: string;
    }
  }
}

export const authenticate = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // No header at all
    if (!authHeader) {
      throw NoTokenError();
    }

    // Header present but not "Bearer <token>" shape
    if (!authHeader.startsWith("Bearer ")) {
      throw TokenMalformedError("Authorization header must use Bearer scheme");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw TokenMalformedError("Token missing after Bearer");
    }

    // jwt.verify throws JsonWebTokenError / TokenExpiredError —
    // both are caught centrally in error.middleware.ts with correct errorCode
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    req.context = {
      tenantId:    decoded.tenantId,
      userId:      decoded.userId,
      role:        decoded.role,
      branchIds:   decoded.branchIds,
      requestId:   req.requestId,
    };

    next();
  } catch (error) {
    next(error);
  }
};