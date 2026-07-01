import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { NoTokenError, TokenMalformedError } from "../errors/app.error";
import { RequestContext } from "../interfaces/request-context.interface";

declare global {
  namespace Express {
    interface Request {
      context:   RequestContext;
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

    if (!authHeader) {
      throw NoTokenError();
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw TokenMalformedError("Authorization header must use Bearer scheme");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw TokenMalformedError("Token missing after Bearer");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    req.context = {
      tenantId:  decoded.tenantId,
      userId:    decoded.userId,
      role:      decoded.role,
      branchIds: decoded.branchIds,
      requestId: req.requestId,
    };

    next();
  } catch (error) {
    next(error);
  }
};