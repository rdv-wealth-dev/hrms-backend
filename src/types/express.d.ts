import { RequestContext } from "../core/interfaces/request-context.interface";

declare global {
  namespace Express {
    interface Request {
      context:   RequestContext;
      requestId: string;
    }
  }
}

export {};