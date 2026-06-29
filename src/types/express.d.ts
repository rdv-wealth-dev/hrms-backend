import "express-serve-static-core";
import { RequestContext } from "../core/interfaces/request-context.interface";

declare module "express-serve-static-core" {
  interface Request {
    context: RequestContext;
    requestId: string;
  }
}

export {};