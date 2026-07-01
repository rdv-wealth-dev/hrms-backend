import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdMiddleware = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  req.requestId = (req.headers["x-request-id"] as string) ?? uuidv4();
  _res.setHeader("x-request-id", req.requestId);
  next();
};