import { Request,Response,NextFunction } from "express";
import jwt from "jsonwebtoken"
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { RequestContext } from "../interfaces/request-context.interface";
import { AppError } from "../errors/app.error";
import { env } from "../../config/env";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
      requestId: string;
    }
  }
}

// Verify jwt + inject req.context
export const authenticate = async (
    req : Request,
    _res : Response,
    next : NextFunction
): Promise<void> => {
    try{
        // extract token from Authentication header
        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith("Bearer")){
            throw new AppError("No token provided", 401);
        }
        const token = authHeader.split(" ")[1];

        if(!token){
            throw new AppError("Invalid token format..!!",  401);
        }

        // verify token
        const decoded = jwt.verify(
            token,
            env.jwtSecret as string,
            

        ) as JwtPayload;

        // inject context - available in all controller + service
        req.context = {
            tenantId : decoded.tenantId,
            userId : decoded.userId,
            role : decoded.role,
            branchIds : decoded.branchIds,
            permissions : decoded.permissions,
            requestId : req.requestId
        };
        next();
    } catch(error){
        next(error)
    }
}